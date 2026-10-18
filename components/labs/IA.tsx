// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { L } from "../I18n";

/** Pontos (horas de estudo → nota) com um pouco de ruído, sempre os mesmos. */
const PONTOS = [[1, 3.1], [2, 4.2], [3, 4.8], [4, 6.1], [5, 6.4], [6, 7.6], [7, 8.0], [8, 9.1]] as const;

/** Regressão por descida de gradiente, passo a passo: a reta y = a·x + b se ajusta aos pontos e o erro cai. */
function RetaQueAprende() {
  const [a, setA] = useState(0);
  const [b, setB] = useState(0);
  const [passos, setPassos] = useState(0);
  const [rodando, setRodando] = useState(false);
  const [taxa, setTaxa] = useState(0.01);
  const erro = PONTOS.reduce((s, [x, y]) => s + (a * x + b - y) ** 2, 0) / PONTOS.length;
  function passo(k = 1) {
    let na = a, nb = b;
    for (let i = 0; i < k; i++) {
      let ga = 0, gb = 0;
      for (const [x, y] of PONTOS) { const d = na * x + nb - y; ga += (2 * d * x) / PONTOS.length; gb += (2 * d) / PONTOS.length; }
      na -= taxa * ga; nb -= taxa * gb;
    }
    setA(na); setB(nb); setPassos((p) => p + k);
  }
  useEffect(() => {
    if (!rodando) return;
    const id = window.setInterval(() => passo(5), 60);
    return () => window.clearInterval(id);
  });
  const px = (x: number) => 30 + (x / 9) * 300;
  const py = (y: number) => 170 - (y / 10) * 150;
  return (
    <section className="border-2 border-ink bg-parchment-deep p-4">
      <h2 className="font-serif text-xl font-semibold">1. Uma reta que aprende</h2>
      <p className="mt-1 text-ink-soft">Horas de estudo (x) e nota (y). A máquina começa com uma reta qualquer e, a cada passo, mexe um pouquinho em a e b na direção que diminui o erro. É o mesmo princípio de redes neurais grandes.</p>
      <div className="mt-3 grid gap-4 md:grid-cols-[22rem_1fr]">
        <svg viewBox="0 0 350 190" className="w-full border border-rule bg-parchment">
          <line x1={30} y1={170} x2={340} y2={170} stroke="#8a5a16" /><line x1={30} y1={10} x2={30} y2={170} stroke="#8a5a16" />
          {PONTOS.map(([x, y]) => <circle key={x} cx={px(x)} cy={py(y)} r={4} fill="#17130e" />)}
          <line x1={px(0)} y1={py(b)} x2={px(9)} y2={py(a * 9 + b)} stroke="#c21f16" strokeWidth={2} />
          <text x={300} y={185} fontSize={9} fill="#4a4032">horas</text><text x={4} y={14} fontSize={9} fill="#4a4032">nota</text>
        </svg>
        <div className="font-mono text-xs">
          <p>y = <strong>{a.toFixed(3)}</strong>·x + <strong>{b.toFixed(3)}</strong></p>
          <p className="mt-1">erro médio quadrático: <strong className={erro < 0.2 ? "text-ok" : ""}>{erro.toFixed(3)}</strong> · passos: {passos}</p>
          <label className="mt-2 block">taxa de aprendizado: {taxa} <input type="range" min={0.001} max={0.05} step={0.001} value={taxa} onChange={(e) => setTaxa(Number(e.target.value))} className="w-full" /></label>
          <p className="mt-2 flex flex-wrap gap-2 font-sans">
            <button type="button" className="cursor-pointer bg-ink px-3 py-1.5 font-semibold text-parchment hover:bg-oxblood" onClick={() => passo(1)}>1 passo</button>
            <button type="button" className="cursor-pointer border-2 border-ink px-3 py-1 font-semibold" onClick={() => setRodando((r) => !r)}>{rodando ? "Pausar" : "Treinar"}</button>
            <button type="button" className="cursor-pointer underline" onClick={() => { setA(0); setB(0); setPassos(0); setRodando(false); }}>Zerar</button>
          </p>
          <p className="mt-2 font-sans text-ink-soft">Taxa alta demais faz a reta “pular” e o erro explodir; baixa demais, demora. Experimente.</p>
        </div>
      </div>
    </section>
  );
}

/** Uma rede 2-3-1 aprendendo o XOR, com os pesos à vista. Tudo em JavaScript puro. */
function RedeMinuscula() {
  const dados = [[0, 0, 0], [0, 1, 1], [1, 0, 1], [1, 1, 0]];
  const [pesos, setPesos] = useState(() => Array.from({ length: 13 }, (_, i) => Math.sin(i * 7.3) * 0.8));
  const [epocas, setEpocas] = useState(0);
  const [rodando, setRodando] = useState(false);
  const sig = (z: number) => 1 / (1 + Math.exp(-z));
  const prever = (w: number[], x1: number, x2: number) => {
    const h = [0, 1, 2].map((j) => sig(w[j * 3] * x1 + w[j * 3 + 1] * x2 + w[j * 3 + 2]));
    return { h, y: sig(w[9] * h[0] + w[10] * h[1] + w[11] * h[2] + w[12]) };
  };
  const treinar = (w: number[], vezes: number) => {
    const n = [...w];
    const taxa = 0.8;
    for (let e = 0; e < vezes; e++) for (const [x1, x2, alvo] of dados) {
      const { h, y } = prever(n, x1, x2);
      const dy = (y - alvo) * y * (1 - y);
      const dh = [0, 1, 2].map((j) => dy * n[9 + j] * h[j] * (1 - h[j]));
      for (let j = 0; j < 3; j++) { n[9 + j] -= taxa * dy * h[j]; n[j * 3] -= taxa * dh[j] * x1; n[j * 3 + 1] -= taxa * dh[j] * x2; n[j * 3 + 2] -= taxa * dh[j]; }
      n[12] -= taxa * dy;
    }
    return n;
  };
  useEffect(() => {
    if (!rodando) return;
    const id = window.setInterval(() => { setPesos((w) => treinar(w, 50)); setEpocas((e) => e + 50); }, 80);
    return () => window.clearInterval(id);
  });
  const erro = dados.reduce((s, [x1, x2, t]) => s + (prever(pesos, x1, x2).y - t) ** 2, 0) / 4;
  const cor = (w: number) => (w > 0 ? "#1d4ed8" : "#c21f16");
  return (
    <section className="mt-6 border-2 border-ink bg-parchment-deep p-4">
      <h2 className="font-serif text-xl font-semibold">2. Uma rede neural minúscula</h2>
      <p className="mt-1 text-ink-soft">Duas entradas, três neurônios escondidos, uma saída. A tarefa: aprender o “ou exclusivo” (XOR), que uma reta sozinha não resolve. A espessura das linhas é o tamanho do peso; azul é positivo, vermelho é negativo. Veja os pesos mudando enquanto o erro cai.</p>
      <div className="mt-3 grid gap-4 md:grid-cols-[22rem_1fr]">
        <svg viewBox="0 0 350 200" className="w-full border border-rule bg-parchment">
          {[0, 1].map((i) => [0, 1, 2].map((j) => <line key={`${i}${j}`} x1={60} y1={60 + i * 80} x2={175} y2={40 + j * 60} stroke={cor(pesos[j * 3 + i])} strokeWidth={Math.min(6, Math.abs(pesos[j * 3 + i]) * 1.5 + 0.3)} />))}
          {[0, 1, 2].map((j) => <line key={`s${j}`} x1={175} y1={40 + j * 60} x2={290} y2={100} stroke={cor(pesos[9 + j])} strokeWidth={Math.min(6, Math.abs(pesos[9 + j]) * 1.5 + 0.3)} />)}
          {[0, 1].map((i) => <circle key={`e${i}`} cx={60} cy={60 + i * 80} r={12} fill="#17130e" />)}
          {[0, 1, 2].map((j) => <circle key={`h${j}`} cx={175} cy={40 + j * 60} r={12} fill="#6e1f1a" />)}
          <circle cx={290} cy={100} r={12} fill="#c21f16" />
          <text x={40} y={64} fontSize={9} fill="#f4ecd8">x1</text><text x={40} y={144} fontSize={9} fill="#f4ecd8">x2</text><text x={285} y={104} fontSize={9} fill="#f4ecd8">y</text>
        </svg>
        <div className="font-mono text-xs">
          <table className="border-collapse"><thead><tr><th className="pr-3 text-left">x1</th><th className="pr-3 text-left">x2</th><th className="pr-3 text-left">alvo</th><th className="text-left">rede diz</th></tr></thead>
            <tbody>{dados.map(([x1, x2, t]) => { const y = prever(pesos, x1, x2).y; return <tr key={`${x1}${x2}`}><td>{x1}</td><td>{x2}</td><td>{t}</td><td className={Math.round(y) === t ? "text-ok" : "text-oxblood"}>{y.toFixed(2)}</td></tr>; })}</tbody></table>
          <p className="mt-2">erro: <strong className={erro < 0.02 ? "text-ok" : ""}>{erro.toFixed(4)}</strong> · épocas: {epocas}</p>
          <p className="mt-2 flex flex-wrap gap-2 font-sans">
            <button type="button" className="cursor-pointer bg-ink px-3 py-1.5 font-semibold text-parchment hover:bg-oxblood" onClick={() => setRodando((r) => !r)}>{rodando ? "Pausar" : "Treinar"}</button>
            <button type="button" className="cursor-pointer underline" onClick={() => { setPesos(Array.from({ length: 13 }, () => (Math.random() - 0.5) * 2)); setEpocas(0); setRodando(false); }}>Pesos novos</button>
          </p>
          <p className="mt-2 font-sans text-ink-soft">Às vezes a rede trava num “mínimo local” e não aprende: sorteie pesos novos e treine de novo. Modelos grandes fazem exatamente isso, com bilhões de pesos.</p>
        </div>
      </div>
    </section>
  );
}

/** O laboratório de IA: modelos de brinquedo para ver a máquina aprender, mais um caderno de Python com exemplos. */
export function LabIA() {
  const exemplos = [
    { nome: "Regressão com numpy", codigo: 'import numpy as np\nx = np.array([1,2,3,4,5,6,7,8], dtype=float)\ny = np.array([3.1,4.2,4.8,6.1,6.4,7.6,8.0,9.1])\na, b = np.polyfit(x, y, 1)\nprint(f"nota ≈ {a:.2f}·horas + {b:.2f}")\nprint("com 10 horas:", round(a*10+b, 1))\n' },
    { nome: "Classificação (k vizinhos, à mão)", codigo: 'pontos = [((1,1),"A"),((1,2),"A"),((2,1),"A"),((6,6),"B"),((7,6),"B"),((6,7),"B")]\ndef classe(p, k=3):\n    viz = sorted(pontos, key=lambda q: (q[0][0]-p[0])**2+(q[0][1]-p[1])**2)[:k]\n    return max(set(c for _, c in viz), key=[c for _, c in viz].count)\nfor p in [(2,2),(5,6),(4,4)]:\n    print(p, "→", classe(p))\n' },
    { nome: "Agrupamento (k-means simples)", codigo: 'import random\nrandom.seed(1)\ndados = [random.gauss(2,0.5) for _ in range(20)] + [random.gauss(8,0.5) for _ in range(20)]\nc = [dados[0], dados[-1]]\nfor _ in range(10):\n    grupos = [[x for x in dados if abs(x-c[0]) <= abs(x-c[1])], [x for x in dados if abs(x-c[0]) > abs(x-c[1])]]\n    c = [sum(g)/len(g) for g in grupos]\nprint("centros:", [round(v,2) for v in c])\n' },
  ];
  return (
    <div className="mt-6 font-sans text-sm">
      <p className="border-l-4 border-gold bg-parchment-deep px-4 py-3">Modelos de brinquedo, não uma “IA grande”: servem para ver, com os olhos, o que “aprender” quer dizer. Tudo roda aqui, no seu navegador.</p>
      <div className="mt-6"><RetaQueAprende /></div>
      <RedeMinuscula />
      <section className="mt-6 border-2 border-ink bg-parchment-deep p-4">
        <h2 className="font-serif text-xl font-semibold">3. Caderno de Python</h2>
        <p className="mt-1 text-ink-soft">Exemplos prontos para abrir na IDE (perfil Python; numpy carrega sob demanda). Conjuntos de dados pequenos, gerados no próprio código.</p>
        <ul className="mt-3 space-y-2">
          {exemplos.map((e) => (
            <li key={e.nome} className="flex flex-wrap items-center justify-between gap-2 border border-rule bg-parchment p-2">
              <span>{e.nome}</span>
              <L href={`/ferramentas/python?codigo=${encodeURIComponent(e.codigo)}`} className="cursor-pointer bg-ink px-3 py-1 font-semibold text-parchment hover:bg-oxblood">Abrir na IDE →</L>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
