// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import type { Dict } from "@/i18n/types";

// Simulações próprias e leves de física e química, para o que o PhET não cobre ou quando a conexão é fraca. Tudo
// calculado no aparelho, sem biblioteca de física: as fórmulas são as do ensino médio e aparecem na tela.

type T = Dict["tools"];

const field = "mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2";
const button = "cursor-pointer bg-ink px-5 py-2.5 font-medium text-parchment hover:bg-oxblood disabled:cursor-not-allowed disabled:opacity-50";
const rotulo = "font-mono text-xs uppercase tracking-widest text-gold";
const numero = (lang: string, v: number, casas = 2) => new Intl.NumberFormat(lang === "pt" ? "pt-BR" : lang, { maximumFractionDigits: casas }).format(v);
const aba = (on: boolean) => `cursor-pointer border-2 px-4 py-2 ${on ? "border-ink bg-ink text-parchment" : "border-rule hover:border-gold"}`;
const cor = (el: Element, nome: string) => getComputedStyle(el).getPropertyValue(nome).trim() || "#000";

function Faixa({ rotulo: nome, valor, min, max, passo = 1, unidade, mudar }: { rotulo: string; valor: number; min: number; max: number; passo?: number; unidade: string; mudar: (v: number) => void }) {
  return (
    <label className="block">
      <span className="flex justify-between">
        <span>{nome}</span>
        <span className="font-mono">
          {valor} {unidade}
        </span>
      </span>
      <input type="range" min={min} max={max} step={passo} value={valor} onChange={(e) => mudar(Number(e.target.value))} className="mt-1 block w-full accent-[var(--oxblood)]" />
    </label>
  );
}

export function FisicaSimulada({ s, lang }: { s: T["physics"]; lang: string }) {
  const [modo, setModo] = useState<"lancamento" | "circuito" | "ondas">("lancamento");
  return (
    <div className="mt-8 font-sans text-sm">
      <div className="flex flex-wrap gap-2" role="group">
        {(["lancamento", "circuito", "ondas"] as const).map((m) => (
          <button key={m} type="button" aria-pressed={modo === m} onClick={() => setModo(m)} className={aba(modo === m)}>
            {s.tabs[m]}
          </button>
        ))}
      </div>
      {modo === "lancamento" && <Lancamento s={s} lang={lang} />}
      {modo === "circuito" && <Circuito s={s} lang={lang} />}
      {modo === "ondas" && <Ondas s={s} lang={lang} />}
    </div>
  );
}

// ───────────── Queda livre e lançamento ─────────────

const GRAVIDADES = { terra: 9.8, lua: 1.6, marte: 3.7, jupiter: 23.1 } as const;

function Lancamento({ s, lang }: { s: T["physics"]; lang: string }) {
  const [v0, setV0] = useState(20);
  const [angulo, setAngulo] = useState(45);
  const [h0, setH0] = useState(0);
  const [lugar, setLugar] = useState<keyof typeof GRAVIDADES>("terra");
  const [voando, setVoando] = useState<number | null>(null);
  const [agora, setAgora] = useState(0);
  const g = GRAVIDADES[lugar];
  const rad = (angulo * Math.PI) / 180;
  const vx = v0 * Math.cos(rad);
  const vy = v0 * Math.sin(rad);
  // Tempo até voltar ao chão: h0 + vy·t − g·t²/2 = 0.
  const tempo = (vy + Math.sqrt(vy * vy + 2 * g * h0)) / g;
  const alcance = vx * tempo;
  const alturaMax = h0 + (vy > 0 ? (vy * vy) / (2 * g) : 0);
  useEffect(() => {
    if (voando === null) return;
    let quadro = 0;
    const passo = (instante: number) => {
      setAgora(instante);
      if ((instante - voando) / 1000 < tempo) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [voando, tempo]);
  const t = voando === null ? 0 : Math.min(tempo, Math.max(0, (agora - voando) / 1000));
  // Desenho em escala: a caixa cabe o alcance e a altura máxima.
  const largura = Math.max(alcance, 1) * 1.1;
  const altura = Math.max(alturaMax, 1) * 1.15;
  const W = 600;
  const H = 260;
  const px = (x: number) => 20 + (x / largura) * (W - 40);
  const py = (y: number) => H - 20 - (y / altura) * (H - 40);
  const pontos = Array.from({ length: 61 }, (_, i) => {
    const ti = (tempo * i) / 60;
    return `${px(vx * ti)},${py(h0 + vy * ti - (g * ti * ti) / 2)}`;
  }).join(" ");
  return (
    <div className="mt-6 grid gap-6 md:grid-cols-[16rem_1fr]">
      <div className="space-y-4">
        <Faixa rotulo={s.speed} valor={v0} min={0} max={60} unidade="m/s" mudar={(v) => { setV0(v); setVoando(null); }} />
        <Faixa rotulo={s.angle} valor={angulo} min={0} max={90} unidade="°" mudar={(v) => { setAngulo(v); setVoando(null); }} />
        <Faixa rotulo={s.height} valor={h0} min={0} max={100} unidade="m" mudar={(v) => { setH0(v); setVoando(null); }} />
        <label className="block">
          {s.gravity}
          <select value={lugar} onChange={(e) => { setLugar(e.target.value as keyof typeof GRAVIDADES); setVoando(null); }} className={field}>
            {Object.entries(GRAVIDADES).map(([id, valor]) => (
              <option key={id} value={id}>{`${(s.places as Record<string, string>)[id]} (${numero(lang, valor, 1)} m/s²)`}</option>
            ))}
          </select>
        </label>
        <button type="button" className={button} onClick={() => setVoando(performance.now())} disabled={tempo <= 0 || !Number.isFinite(tempo)}>{s.launch}</button>
        <p className="text-xs text-ink-soft">{s.freeFallHint}</p>
      </div>
      <div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full border-2 border-ink bg-parchment-deep" role="img" aria-label={s.tabs.lancamento}>
          <line x1={10} y1={H - 20} x2={W - 10} y2={H - 20} stroke="var(--ink)" strokeWidth={2} />
          {h0 > 0 && <rect x={px(0) - 12} y={py(h0)} width={12} height={H - 20 - py(h0)} fill="var(--rule)" />}
          {Number.isFinite(tempo) && tempo > 0 && <polyline points={pontos} fill="none" stroke="var(--gold)" strokeWidth={2} strokeDasharray="6 4" />}
          <circle cx={px(vx * t)} cy={py(h0 + vy * t - (g * t * t) / 2)} r={7} fill="var(--oxblood)" />
        </svg>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            [s.range, `${numero(lang, alcance)} m`],
            [s.maxHeight, `${numero(lang, alturaMax)} m`],
            [s.flightTime, `${numero(lang, tempo)} s`],
          ].map(([nome, valor]) => (
            <div key={nome} className="border border-rule p-2">
              <dt className={rotulo}>{nome}</dt>
              <dd className="mt-1 font-mono text-base">{valor}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 font-mono text-xs text-ink-soft">x = v₀·cos θ·t · y = h₀ + v₀·sen θ·t − g·t²/2 · {s.noAir}</p>
      </div>
    </div>
  );
}

// ───────────── Circuito: lei de Ohm, série e paralelo ─────────────

function Circuito({ s, lang }: { s: T["physics"]; lang: string }) {
  const [u, setU] = useState(12);
  const [rs, setRs] = useState([100, 200, 300]);
  const [ligacao, setLigacao] = useState<"serie" | "paralelo">("serie");
  const req = ligacao === "serie" ? rs.reduce((a, b) => a + b, 0) : 1 / rs.reduce((a, b) => a + 1 / b, 0);
  const i = u / req;
  const linhas = rs.map((r) =>
    ligacao === "serie" ? { r, u: i * r, i } : { r, u, i: u / r },
  );
  const W = 600;
  const H = 220;
  return (
    <div className="mt-6 grid gap-6 md:grid-cols-[16rem_1fr]">
      <div className="space-y-4">
        <Faixa rotulo={s.voltage} valor={u} min={1} max={24} unidade="V" mudar={setU} />
        {rs.map((r, k) => (
          <Faixa key={k} rotulo={`R${k + 1}`} valor={r} min={10} max={1000} passo={10} unidade="Ω" mudar={(v) => setRs((atual) => atual.map((x, j) => (j === k ? v : x)))} />
        ))}
        <div className="flex gap-2" role="group">
          {(["serie", "paralelo"] as const).map((l) => (
            <button key={l} type="button" aria-pressed={ligacao === l} onClick={() => setLigacao(l)} className={aba(ligacao === l)}>
              {l === "serie" ? s.series : s.parallel}
            </button>
          ))}
        </div>
      </div>
      <div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full border-2 border-ink bg-parchment-deep" role="img" aria-label={ligacao === "serie" ? s.series : s.parallel}>
          {/* Bateria à esquerda; o fio fecha o circuito por cima e por baixo. */}
          <line x1={40} y1={95} x2={40} y2={125} stroke="var(--ink)" strokeWidth={2} />
          <line x1={30} y1={100} x2={50} y2={100} stroke="var(--ink)" strokeWidth={4} />
          <line x1={34} y1={120} x2={46} y2={120} stroke="var(--ink)" strokeWidth={2} />
          <text x={58} y={115} fontSize={14} fill="var(--ink)">{`${u} V`}</text>
          <polyline points={`40,95 40,30 560,30 560,190 40,190 40,125`} fill="none" stroke="var(--ink)" strokeWidth={2} />
          {ligacao === "serie"
            ? rs.map((r, k) => (
                <g key={k}>
                  <rect x={150 + k * 140} y={20} width={70} height={20} fill="var(--parchment)" stroke="var(--oxblood)" strokeWidth={2} />
                  <text x={185 + k * 140} y={60} fontSize={13} textAnchor="middle" fill="var(--ink)">{`R${k + 1} = ${r} Ω`}</text>
                </g>
              ))
            : rs.map((r, k) => (
                <g key={k}>
                  <polyline points={`${220 + k * 110},30 ${220 + k * 110},190`} fill="none" stroke="var(--ink)" strokeWidth={2} />
                  <rect x={210 + k * 110} y={85} width={20} height={50} fill="var(--parchment)" stroke="var(--oxblood)" strokeWidth={2} />
                  <text x={240 + k * 110} y={115} fontSize={13} fill="var(--ink)">{`R${k + 1}`}</text>
                </g>
              ))}
          <text x={300} y={212} fontSize={13} textAnchor="middle" fill="var(--ink)">{`i = ${numero(lang, i * 1000, 1)} mA`}</text>
        </svg>
        <p className="mt-3 font-mono">
          {s.equivalent}: {numero(lang, req, 1)} Ω · {s.current}: {numero(lang, i * 1000, 1)} mA · {s.power}: {numero(lang, u * i, 3)} W
        </p>
        <table className="mt-3 w-full max-w-md border-collapse text-left font-mono">
          <thead>
            <tr className="border-b-2 border-ink font-sans">
              <th className="py-1 pr-3" />
              <th className="py-1 pr-3">U (V)</th>
              <th className="py-1 pr-3">i (mA)</th>
              <th className="py-1">P (W)</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, k) => (
              <tr key={k} className="border-b border-rule">
                <td className="py-1 pr-3">R{k + 1}</td>
                <td className="py-1 pr-3">{numero(lang, l.u)}</td>
                <td className="py-1 pr-3">{numero(lang, l.i * 1000, 1)}</td>
                <td className="py-1">{numero(lang, l.u * l.i, 3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-ink-soft">{ligacao === "serie" ? s.seriesNote : s.parallelNote} {s.ohmNote}</p>
      </div>
    </div>
  );
}

// ───────────── Ondas ─────────────

function Ondas({ s, lang }: { s: T["physics"]; lang: string }) {
  const tela = useRef<HTMLCanvasElement>(null);
  const [amplitude, setAmplitude] = useState(40);
  const [frequencia, setFrequencia] = useState(1);
  const [comprimento, setComprimento] = useState(200);
  const [segunda, setSegunda] = useState(false);
  const [frequencia2, setFrequencia2] = useState(1.2);
  const valores = useRef({ amplitude, frequencia, comprimento, segunda, frequencia2 });
  useEffect(() => {
    valores.current = { amplitude, frequencia, comprimento, segunda, frequencia2 };
  }, [amplitude, frequencia, comprimento, segunda, frequencia2]);
  useEffect(() => {
    const canvas = tela.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let quadro = 0;
    const inicio = performance.now();
    const desenhar = (agora: number) => {
      const t = (agora - inicio) / 1000;
      const largura = canvas.clientWidth;
      const altura = 220;
      if (canvas.width !== largura * devicePixelRatio) {
        canvas.width = largura * devicePixelRatio;
        canvas.height = altura * devicePixelRatio;
      }
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      ctx.clearRect(0, 0, largura, altura);
      const v = valores.current;
      const meio = altura / 2;
      ctx.strokeStyle = cor(canvas, "--rule");
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, meio);
      ctx.lineTo(largura, meio);
      ctx.stroke();
      const onda = (x: number, f: number) => Math.sin(2 * Math.PI * (x / v.comprimento - f * t));
      const tracar = (y: (x: number) => number, estilo: string, espessura: number) => {
        ctx.strokeStyle = estilo;
        ctx.lineWidth = espessura;
        ctx.beginPath();
        for (let x = 0; x <= largura; x += 2) ctx.lineTo(x, meio - y(x));
        ctx.stroke();
      };
      if (v.segunda) {
        tracar((x) => (v.amplitude / 2) * onda(x, v.frequencia), cor(canvas, "--gold"), 1);
        tracar((x) => (v.amplitude / 2) * onda(x, v.frequencia2), cor(canvas, "--ink-soft"), 1);
        tracar((x) => (v.amplitude / 2) * (onda(x, v.frequencia) + onda(x, v.frequencia2)), cor(canvas, "--oxblood"), 2.5);
      } else tracar((x) => v.amplitude * onda(x, v.frequencia), cor(canvas, "--oxblood"), 2.5);
      quadro = requestAnimationFrame(desenhar);
    };
    quadro = requestAnimationFrame(desenhar);
    return () => cancelAnimationFrame(quadro);
  }, []);
  // A escala da tela: 100 px = 1 m.
  const lambda = comprimento / 100;
  return (
    <div className="mt-6 grid gap-6 md:grid-cols-[16rem_1fr]">
      <div className="space-y-4">
        <Faixa rotulo={s.amplitude} valor={amplitude} min={5} max={90} unidade="px" mudar={setAmplitude} />
        <Faixa rotulo={s.frequency} valor={frequencia} min={0.2} max={3} passo={0.1} unidade="Hz" mudar={setFrequencia} />
        <Faixa rotulo={s.wavelength} valor={lambda} min={0.5} max={4} passo={0.1} unidade="m" mudar={(v) => setComprimento(Math.round(v * 100))} />
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={segunda} onChange={(e) => setSegunda(e.target.checked)} className="accent-[var(--oxblood)]" />
          {s.superpose}
        </label>
        {segunda && <Faixa rotulo={s.frequency2} valor={frequencia2} min={0.2} max={3} passo={0.1} unidade="Hz" mudar={setFrequencia2} />}
      </div>
      <div>
        <canvas ref={tela} role="img" aria-label={s.tabs.ondas} className="h-[220px] w-full border-2 border-ink bg-parchment-deep" />
        <p className="mt-3 font-mono">
          v = λ · f = {numero(lang, lambda)} m × {numero(lang, frequencia, 1)} Hz = {numero(lang, lambda * frequencia)} m/s · T = 1/f = {numero(lang, 1 / frequencia)} s
        </p>
        <p className="mt-2 text-xs text-ink-soft">{segunda ? s.superposeNote : s.waveNote}</p>
      </div>
    </div>
  );
}

// ───────────── Reações químicas com átomos ─────────────

type Atomo = "H" | "O" | "C" | "N" | "Na" | "Cl";
const CORES: Record<Atomo, string> = { H: "#f5f5f0", O: "#d33b2c", C: "#3a3a3a", N: "#3d6fd6", Na: "#8a4fbf", Cl: "#3fa34d" };
const RAIOS: Record<Atomo, number> = { H: 9, O: 13, C: 13, N: 13, Na: 15, Cl: 15 };

/** Cada reação: as moléculas de cada lado (já com os coeficientes) e o desenho de cada uma. */
const REACOES: { id: string; equacao: string; reagentes: Atomo[][]; produtos: Atomo[][] }[] = [
  { id: "agua", equacao: "2 H₂ + O₂ → 2 H₂O", reagentes: [["H", "H"], ["H", "H"], ["O", "O"]], produtos: [["O", "H", "H"], ["O", "H", "H"]] },
  { id: "amonia", equacao: "N₂ + 3 H₂ → 2 NH₃", reagentes: [["N", "N"], ["H", "H"], ["H", "H"], ["H", "H"]], produtos: [["N", "H", "H", "H"], ["N", "H", "H", "H"]] },
  { id: "metano", equacao: "CH₄ + 2 O₂ → CO₂ + 2 H₂O", reagentes: [["C", "H", "H", "H", "H"], ["O", "O"], ["O", "O"]], produtos: [["C", "O", "O"], ["O", "H", "H"], ["O", "H", "H"]] },
  { id: "sal", equacao: "2 Na + Cl₂ → 2 NaCl", reagentes: [["Na"], ["Na"], ["Cl", "Cl"]], produtos: [["Na", "Cl"], ["Na", "Cl"]] },
];

/** Posições dos átomos de cada molécula: o primeiro no centro, os outros em volta. */
function posicoes(moleculas: Atomo[][], x0: number, largura: number) {
  const passo = largura / moleculas.length;
  return moleculas.flatMap((m, k) => {
    const cx = x0 + passo * (k + 0.5);
    const cy = 110;
    return m.map((atomo, j) => {
      if (j === 0) return { atomo, x: cx, y: cy };
      const angulo = (Math.PI * 2 * (j - 1)) / Math.max(1, m.length - 1) - Math.PI / 2;
      const d = RAIOS[m[0]] + RAIOS[atomo] - 4;
      return { atomo, x: cx + d * Math.cos(angulo), y: cy + d * Math.sin(angulo) };
    });
  });
}

export function Reacoes({ s }: { s: T["reaction"] }) {
  const [id, setId] = useState(REACOES[0].id);
  const [reagiu, setReagiu] = useState(false);
  const reacao = REACOES.find((r) => r.id === id) ?? REACOES[0];
  const antes = posicoes(reacao.reagentes, 0, 600);
  const depois = posicoes(reacao.produtos, 0, 600);
  // Cada átomo da esquerda vai para o primeiro lugar livre do mesmo elemento na direita: nada some, nada aparece.
  const usados = new Set<number>();
  const destino = antes.map((a) => {
    const k = depois.findIndex((d, i) => !usados.has(i) && d.atomo === a.atomo);
    usados.add(k);
    return depois[k] ?? a;
  });
  const contar = (moleculas: Atomo[][]) => {
    const total = new Map<Atomo, number>();
    moleculas.flat().forEach((a) => total.set(a, (total.get(a) ?? 0) + 1));
    return [...total.entries()];
  };
  const nomes = s.names as Record<string, string>;
  return (
    <div className="mt-8 font-sans text-sm">
      <div className="flex flex-wrap gap-2" role="group">
        {REACOES.map((r) => (
          <button key={r.id} type="button" aria-pressed={id === r.id} onClick={() => { setId(r.id); setReagiu(false); }} className={aba(id === r.id)}>
            {nomes[r.id]}
          </button>
        ))}
      </div>
      <p className="mt-5 font-mono text-xl">{reacao.equacao}</p>
      <svg viewBox="0 0 600 220" className="mt-3 w-full max-w-2xl border-2 border-ink bg-parchment-deep" role="img" aria-label={`${reacao.equacao}: ${reagiu ? s.products : s.reactants}`}>
        {antes.map((a, k) => {
          const alvo = reagiu ? destino[k] : a;
          return (
            <circle
              key={k}
              cx={0}
              cy={0}
              r={RAIOS[a.atomo]}
              fill={CORES[a.atomo]}
              stroke="#222"
              strokeWidth={1.5}
              style={{ transform: `translate(${alvo.x}px, ${alvo.y}px)`, transition: "transform 1.4s ease-in-out" }}
            />
          );
        })}
        <text x={300} y={205} fontSize={14} textAnchor="middle" fill="var(--ink)">{reagiu ? s.products : s.reactants}</text>
      </svg>
      <p className="mt-2 flex flex-wrap gap-3 text-xs">
        {(Object.keys(CORES) as Atomo[])
          .filter((a) => reacao.reagentes.flat().includes(a))
          .map((a) => (
            <span key={a} className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-full border border-ink" style={{ background: CORES[a] }} /> {a}
            </span>
          ))}
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" className={button} onClick={() => setReagiu(true)} disabled={reagiu}>{s.react}</button>
        <button type="button" className="cursor-pointer border-2 border-ink px-5 py-2 hover:bg-ink hover:text-parchment" onClick={() => setReagiu(false)}>{s.reset}</button>
      </div>
      <div className="mt-5 grid max-w-md grid-cols-2 gap-4">
        {[
          [s.reactants, contar(reacao.reagentes)],
          [s.products, contar(reacao.produtos)],
        ].map(([titulo, lista]) => (
          <div key={titulo as string}>
            <p className={rotulo}>{titulo as string}</p>
            <ul className="mt-1 font-mono">
              {(lista as [Atomo, number][]).map(([a, n]) => (
                <li key={a}>
                  {a}: {n}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-4 text-ink-soft">{s.note}</p>
    </div>
  );
}
