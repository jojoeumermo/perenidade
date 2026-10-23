// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { Selo } from "../Selo";
import { useEffect, useRef, useState } from "react";

// A caixa de ferramentas do professor na hora de projetar: temporizador, sorteio de nomes, grupos, placar e quadro
// para riscar por cima da tela. Os nomes da turma ficam só neste navegador e não vão no arquivo da sala (que pode ser
// mandado a um colega).

const chaveNomes = (sala: string) => `lucia:sala-livre:nomes:${sala}`;
export function lerNomes(sala: string) {
  try {
    return window.localStorage.getItem(chaveNomes(sala)) ?? "";
  } catch {
    return "";
  }
}
function gravarNomes(sala: string, texto: string) {
  try {
    window.localStorage.setItem(chaveNomes(sala), texto);
  } catch {
    // Sem espaço ou modo anônimo: os nomes valem só enquanto a tela estiver aberta.
  }
}
const listaDeNomes = (texto: string) => [...new Set(texto.split(/\r?\n|,|;/).map((n) => n.trim()).filter(Boolean))].slice(0, 200);

function embaralhar<T>(lista: T[]) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Um bipe curto no fim do tempo (Web Audio, sem arquivo de som). */
function bipe() {
  try {
    const ctx = new AudioContext();
    [0, 0.35, 0.7].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.25, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.3);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.3);
    });
    setTimeout(() => void ctx.close(), 1500);
  } catch {
    // Sem áudio: o aviso fica só na tela.
  }
}

export const mmss = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** O relógio da tela: atualiza a cada meio segundo enquanto estiver ligado. */
export function useAgora(ligado = true) {
  const [agora, setAgora] = useState(0);
  useEffect(() => {
    if (!ligado) return;
    const id = window.setInterval(() => setAgora(Date.now()), 500);
    const primeiro = window.setTimeout(() => setAgora(Date.now()), 0);
    return () => { window.clearInterval(id); window.clearTimeout(primeiro); };
  }, [ligado]);
  return agora;
}

function Temporizador() {
  const [total, setTotal] = useState(5 * 60_000);
  const [fim, setFim] = useState<number | null>(null);
  const [parado, setParado] = useState<number | null>(null);
  const [tocou, setTocou] = useState(false);
  const agora = useAgora(fim !== null);
  const resta = fim !== null ? (agora ? fim - agora : total) : parado ?? total;
  useEffect(() => {
    if (fim === null || !agora || agora < fim || tocou) return;
    bipe();
    void Promise.resolve().then(() => setTocou(true));
  }, [agora, fim, tocou]);
  const iniciar = (ms: number) => { setTotal(ms); setParado(null); setTocou(false); setFim(Date.now() + ms); };
  const acabou = fim !== null && resta <= 0;
  const fracao = Math.max(0, Math.min(1, resta / total));
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {[1, 3, 5, 10, 15, 20].map((m) => <button key={m} type="button" onClick={() => iniciar(m * 60_000)} className="cursor-pointer rounded border-2 border-ink/30 px-2.5 py-1 text-sm font-semibold hover:border-ink">{m} min</button>)}
      </div>
      <div className={`mt-4 rounded-lg p-6 text-center ${acabou ? "animate-pulse bg-[#c21f16] text-white" : "bg-[#17130e] text-[#f4ecd8]"}`}>
        <p className="font-mono text-7xl font-bold tabular-nums">{acabou ? "Tempo!" : mmss(resta)}</p>
        <div className="mx-auto mt-4 h-2 max-w-sm overflow-hidden rounded bg-white/15"><div className="h-full bg-[#ffd27a] transition-[width] duration-500" style={{ width: `${fracao * 100}%` }} /></div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        {fim !== null && !acabou && <button type="button" onClick={() => { setParado(resta); setFim(null); }} className="cursor-pointer rounded border-2 border-ink px-3 py-1 font-semibold">⏸ Pausar</button>}
        {fim === null && parado !== null && <button type="button" onClick={() => { setFim(Date.now() + parado); setParado(null); }} className="cursor-pointer rounded border-2 border-ink px-3 py-1 font-semibold">▶ Continuar</button>}
        {(fim !== null || parado !== null) && <button type="button" onClick={() => { setFim(null); setParado(null); setTocou(false); }} className="cursor-pointer rounded px-3 py-1 underline">Zerar</button>}
      </div>
    </div>
  );
}

function Nomes({ sala, texto, mudar }: { sala: string; texto: string; mudar: (t: string) => void }) {
  return (
    <details className="text-sm" open={!texto}>
      <summary className="cursor-pointer font-semibold">Nomes da turma ({listaDeNomes(texto).length})</summary>
      <textarea value={texto} onChange={(e) => { mudar(e.target.value.slice(0, 8000)); gravarNomes(sala, e.target.value.slice(0, 8000)); }} rows={5} placeholder={"Um nome por linha\nAna\nBruno\nCarla"} className="mt-1 w-full border-2 border-ink/30 bg-parchment p-2" />
      <p className="text-xs text-ink-soft">Ficam só neste navegador e não vão no arquivo da sala.</p>
    </details>
  );
}

function Sorteio({ sala }: { sala: string }) {
  const [texto, setTexto] = useState(() => lerNomes(sala));
  const [saiu, setSaiu] = useState<string[]>([]);
  const [girando, setGirando] = useState<string | null>(null);
  const nomes = listaDeNomes(texto);
  const restam = nomes.filter((n) => !saiu.includes(n));
  function sortear() {
    if (!restam.length) return;
    const ordem = embaralhar(restam);
    let k = 0;
    const id = window.setInterval(() => {
      setGirando(ordem[k % ordem.length]);
      k++;
      if (k > 12) {
        window.clearInterval(id);
        setGirando(null);
        setSaiu((s) => [...s, ordem[0]]);
      }
    }, 70);
  }
  const atual = girando ?? saiu[saiu.length - 1];
  return (
    <div>
      <Nomes sala={sala} texto={texto} mudar={setTexto} />
      <div className="mt-3 rounded-lg bg-[#17130e] p-6 text-center text-[#f4ecd8]">
        <p className={`font-serif text-5xl font-semibold ${girando ? "opacity-60" : ""}`}>{atual ?? "—"}</p>
        <p className="mt-2 text-xs text-[#f4ecd8]/70">{restam.length} de {nomes.length} ainda não saíram</p>
      </div>
      <div className="mt-3 flex gap-2 text-sm">
        <button type="button" onClick={sortear} disabled={!restam.length || girando !== null} className="cursor-pointer rounded bg-[#c21f16] px-4 py-1.5 font-bold text-white disabled:opacity-40">🎲 Sortear</button>
        <button type="button" onClick={() => setSaiu([])} className="cursor-pointer underline">Recomeçar</button>
      </div>
    </div>
  );
}

function Grupos({ sala }: { sala: string }) {
  const [texto, setTexto] = useState(() => lerNomes(sala));
  const [n, setN] = useState(4);
  const [grupos, setGrupos] = useState<string[][]>([]);
  const nomes = listaDeNomes(texto);
  const formar = () => {
    const e = embaralhar(nomes);
    setGrupos(Array.from({ length: Math.min(n, Math.max(1, e.length)) }, (_, g) => e.filter((_, i) => i % n === g)));
  };
  return (
    <div>
      <Nomes sala={sala} texto={texto} mudar={setTexto} />
      <div className="mt-3 flex items-center gap-2 text-sm">
        <label className="flex items-center gap-2">Grupos <input type="number" min={2} max={12} value={n} onChange={(e) => setN(Math.min(12, Math.max(2, Number(e.target.value) || 2)))} className="w-16 border-2 border-ink/30 bg-parchment px-2 py-1" /></label>
        <button type="button" onClick={formar} disabled={nomes.length < 2} className="cursor-pointer rounded bg-[#c21f16] px-4 py-1.5 font-bold text-white disabled:opacity-40">Formar grupos</button>
      </div>
      <ol className="mt-3 grid gap-2 sm:grid-cols-2">
        {grupos.map((g, i) => <li key={i} className="rounded border-2 border-ink bg-parchment p-2 text-sm"><strong>Grupo {i + 1}</strong><br />{g.join(", ")}</li>)}
      </ol>
    </div>
  );
}

const CORES_EQUIPE = ["#c21f16", "#1e56c8", "#2e7d32", "#b8860b"];
function Placar() {
  const [equipes, setEquipes] = useState([{ nome: "Equipe A", pontos: 0 }, { nome: "Equipe B", pontos: 0 }]);
  const mudar = (i: number, x: Partial<(typeof equipes)[number]>) => setEquipes((l) => l.map((e, j) => (j === i ? { ...e, ...x } : e)));
  return (
    <div>
      <div className="grid gap-2 sm:grid-cols-2">
        {equipes.map((e, i) => (
          <div key={i} className="rounded-lg p-3 text-center text-white" style={{ background: CORES_EQUIPE[i] }}>
            <input value={e.nome} onChange={(ev) => mudar(i, { nome: ev.target.value.slice(0, 30) })} aria-label="Nome da equipe" className="w-full bg-transparent text-center font-semibold outline-none" />
            <p className="font-mono text-6xl font-bold tabular-nums">{e.pontos}</p>
            <div className="mt-1 flex justify-center gap-2">
              <button type="button" onClick={() => mudar(i, { pontos: e.pontos - 1 })} className="cursor-pointer rounded bg-black/25 px-3 py-1 font-bold">−1</button>
              <button type="button" onClick={() => mudar(i, { pontos: e.pontos + 1 })} className="cursor-pointer rounded bg-black/25 px-3 py-1 font-bold">+1</button>
              <button type="button" onClick={() => mudar(i, { pontos: e.pontos + 5 })} className="cursor-pointer rounded bg-black/25 px-3 py-1 font-bold">+5</button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-3 text-sm">
        {equipes.length < 4 && <button type="button" onClick={() => setEquipes((l) => [...l, { nome: `Equipe ${"ABCD"[l.length]}`, pontos: 0 }])} className="cursor-pointer underline">＋ Equipe</button>}
        {equipes.length > 2 && <button type="button" onClick={() => setEquipes((l) => l.slice(0, -1))} className="cursor-pointer underline">− Equipe</button>}
        <button type="button" onClick={() => setEquipes((l) => l.map((e) => ({ ...e, pontos: 0 })))} className="cursor-pointer underline">Zerar</button>
      </div>
    </div>
  );
}

/** O quadro para riscar por cima da tela projetada: caneta, cores, borracha e limpar. */
export function Quadro({ fechar }: { fechar: () => void }) {
  const tela = useRef<HTMLCanvasElement>(null);
  const [cor, setCor] = useState("#c21f16");
  const [borracha, setBorracha] = useState(false);
  const desenhando = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const c = tela.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = c.clientWidth * dpr;
    c.height = c.clientHeight * dpr;
    c.getContext("2d")?.scale(dpr, dpr);
  }, []);
  const ponto = (e: React.PointerEvent<HTMLCanvasElement>) => { const r = e.currentTarget.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const riscar = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = e.currentTarget.getContext("2d");
    const de = desenhando.current;
    if (!ctx || !de) return;
    const p = ponto(e);
    ctx.globalCompositeOperation = borracha ? "destination-out" : "source-over";
    ctx.strokeStyle = cor;
    ctx.lineWidth = borracha ? 28 : 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(de.x, de.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    desenhando.current = p;
  };
  return (
    <div className="absolute inset-0 z-20">
      <canvas ref={tela} className="h-full w-full cursor-crosshair touch-none" onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); desenhando.current = ponto(e); }} onPointerMove={riscar} onPointerUp={() => { desenhando.current = null; }} aria-label="Quadro para riscar por cima da tela" />
      <div className="absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-2 rounded-full border-2 border-ink bg-parchment px-3 py-1.5 font-sans text-sm shadow-lg">
        {["#c21f16", "#1e56c8", "#2e7d32", "#17130e", "#f5d000"].map((c) => <button key={c} type="button" aria-label={`Caneta ${c}`} aria-pressed={!borracha && cor === c} onClick={() => { setCor(c); setBorracha(false); }} className={`h-6 w-6 cursor-pointer rounded-full border-2 ${!borracha && cor === c ? "border-ink ring-2 ring-ink/40" : "border-white"}`} style={{ background: c }} />)}
        <button type="button" aria-pressed={borracha} onClick={() => setBorracha(!borracha)} className={`cursor-pointer rounded px-2 ${borracha ? "bg-ink text-parchment" : ""}`}>Borracha</button>
        <button type="button" onClick={() => { const c = tela.current; c?.getContext("2d")?.clearRect(0, 0, c.width, c.height); }} className="cursor-pointer px-2 underline">Limpar</button>
        <button type="button" onClick={fechar} className="cursor-pointer rounded bg-ink px-2 py-0.5 font-bold text-parchment">Fechar quadro</button>
      </div>
    </div>
  );
}

export type Ferramenta = "tempo" | "sorteio" | "grupos" | "placar";
export const FERRAMENTAS: { id: Ferramenta; nome: string; icone: string }[] = [
  { id: "tempo", nome: "Temporizador", icone: "cronometro" },
  { id: "sorteio", nome: "Sortear nome", icone: "dado" },
  { id: "grupos", nome: "Formar grupos", icone: "pessoas" },
  { id: "placar", nome: "Placar", icone: "trofeu" },
];

/** A gaveta lateral com as ferramentas. Fica montada (escondida) para o temporizador continuar contando. */
export function Gaveta({ sala, aberta, ferramenta, escolher, fechar }: { sala: string; aberta: boolean; ferramenta: Ferramenta; escolher: (f: Ferramenta) => void; fechar: () => void }) {
  return (
    <aside aria-label="Ferramentas da aula" hidden={!aberta} className="absolute inset-y-0 right-0 z-30 w-full max-w-md overflow-y-auto border-l-4 border-ink bg-parchment p-4 font-sans shadow-2xl">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-2xl font-semibold">Ferramentas da aula</h2>
        <button type="button" onClick={fechar} className="cursor-pointer rounded border-2 border-ink px-2 py-0.5 text-sm font-semibold">Fechar</button>
      </div>
      <div role="tablist" className="mt-3 grid grid-cols-4 gap-1">
        {FERRAMENTAS.map((f) => <button key={f.id} type="button" role="tab" aria-selected={ferramenta === f.id} onClick={() => escolher(f.id)} className={`cursor-pointer rounded border-2 px-1 py-2 text-xs font-semibold ${ferramenta === f.id ? "border-ink bg-ink text-parchment" : "border-ink/25"}`}><Selo nome={f.icone} className="mx-auto mb-1 block h-6 w-6" />{f.nome}</button>)}
      </div>
      <div className="mt-4">
        <div hidden={ferramenta !== "tempo"}><Temporizador /></div>
        {ferramenta === "sorteio" && <Sorteio sala={sala} />}
        {ferramenta === "grupos" && <Grupos sala={sala} />}
        <div hidden={ferramenta !== "placar"}><Placar /></div>
      </div>
    </aside>
  );
}
