// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import { Mascote, NotaParaOAdulto } from "./comum";

/**
 * Programação em blocos: a criança monta a lista de comandos (andar, virar, repetir) e o robozinho segue, passo a
 * passo, até a estrela. Feito aqui, sem biblioteca: blocos grandes de tocar, sem digitar.
 */
type Dir = 0 | 1 | 2 | 3; // 0 cima, 1 direita, 2 baixo, 3 esquerda
type Bloco = { tipo: "andar" | "esquerda" | "direita" } | { tipo: "repetir"; vezes: number; corpo: ("andar" | "esquerda" | "direita")[] };
interface Fase { nome: string; tamanho: number; inicio: [number, number, Dir]; estrela: [number, number]; paredes: [number, number][]; dica: string; repetir?: boolean }

const FASES: Fase[] = [
  { nome: "Em frente", tamanho: 5, inicio: [0, 2, 1], estrela: [3, 2], paredes: [], dica: "Ande três vezes para a direita." },
  { nome: "Uma curva", tamanho: 5, inicio: [0, 4, 0], estrela: [2, 1], paredes: [[1, 4], [1, 3]], dica: "Suba, vire à direita e ande." },
  { nome: "O muro", tamanho: 6, inicio: [0, 0, 1], estrela: [4, 2], paredes: [[2, 0], [2, 1]], dica: "Desça antes de chegar ao muro." },
  { nome: "Zigue-zague", tamanho: 6, inicio: [0, 5, 0], estrela: [4, 1], paredes: [[0, 2], [2, 4], [2, 3], [4, 4], [4, 3]], dica: "Use várias curvas." },
  { nome: "Repetir", tamanho: 7, inicio: [0, 3, 1], estrela: [6, 3], paredes: [], dica: "Use o bloco Repetir para andar 6 vezes com um bloco só.", repetir: true },
  { nome: "Escada", tamanho: 6, inicio: [0, 5, 1], estrela: [4, 1], paredes: [[1, 5], [2, 4], [3, 3], [4, 2]], dica: "Andar, virar, andar, virar… dá para repetir esse pedaço!", repetir: true },
];
const NOMES = { andar: "⬆️ Andar", esquerda: "↪️ Virar à esquerda", direita: "↩️ Virar à direita" } as const;
const PASSO: Record<Dir, [number, number]> = { 0: [0, -1], 1: [1, 0], 2: [0, 1], 3: [-1, 0] };

function expandir(blocos: Bloco[]): ("andar" | "esquerda" | "direita")[] {
  return blocos.flatMap((b) => (b.tipo === "repetir" ? Array.from({ length: b.vezes }, () => b.corpo).flat() : [b.tipo]));
}

function Robozinho({ dir }: { dir: Dir }) {
  return (
    <svg viewBox="0 0 40 40" className="h-full w-full" style={{ transform: `rotate(${dir * 90}deg)`, transition: "transform .25s" }} aria-hidden>
      <rect x="8" y="10" width="24" height="22" rx="6" fill="#7AB8E8" stroke="#221C17" strokeWidth="2.5" />
      <circle cx="15" cy="19" r="3" fill="#221C17" />
      <circle cx="25" cy="19" r="3" fill="#221C17" />
      <path d="M20 3 L26 10 H14 Z" fill="#7A1F1F" />
    </svg>
  );
}

export function Robo() {
  const [n, setN] = useState(0);
  const fase = FASES[n];
  const [blocos, setBlocos] = useState<Bloco[]>([]);
  const [vezes, setVezes] = useState(3);
  const [corpo, setCorpo] = useState<("andar" | "esquerda" | "direita")[]>([]);
  const [pos, setPos] = useState<[number, number, Dir]>(fase.inicio);
  const [estado, setEstado] = useState<"montando" | "rodando" | "chegou" | "bateu" | "parou">("montando");
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current) window.clearInterval(timer.current); }, []);

  const parede = (x: number, y: number) => fase.paredes.some(([a, b]) => a === x && b === y);
  function trocarFase(i: number) {
    if (timer.current) window.clearInterval(timer.current);
    setN(i);
    setBlocos([]);
    setCorpo([]);
    setPos(FASES[i].inicio);
    setEstado("montando");
  }
  function rodar() {
    const passos = expandir(blocos);
    let atual: [number, number, Dir] = fase.inicio;
    let i = 0;
    setPos(atual);
    setEstado("rodando");
    timer.current = window.setInterval(() => {
      if (i >= passos.length) {
        window.clearInterval(timer.current!);
        setEstado(atual[0] === fase.estrela[0] && atual[1] === fase.estrela[1] ? "chegou" : "parou");
        return;
      }
      const p = passos[i++];
      const [x, y, d] = atual;
      if (p === "esquerda") atual = [x, y, ((d + 3) % 4) as Dir];
      else if (p === "direita") atual = [x, y, ((d + 1) % 4) as Dir];
      else {
        const nx = x + PASSO[d][0];
        const ny = y + PASSO[d][1];
        if (nx < 0 || ny < 0 || nx >= fase.tamanho || ny >= fase.tamanho || parede(nx, ny)) {
          window.clearInterval(timer.current!);
          setEstado("bateu");
          return;
        }
        atual = [nx, ny, d];
      }
      setPos(atual);
      if (atual[0] === fase.estrela[0] && atual[1] === fase.estrela[1] && i >= passos.length) {
        window.clearInterval(timer.current!);
        setEstado("chegou");
      }
    }, 450);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {FASES.map((f, i) => (
          <button key={f.nome} type="button" onClick={() => trocarFase(i)} className={`min-h-12 cursor-pointer rounded-full border-4 border-ink px-4 text-lg font-bold ${i === n ? "bg-ink text-white" : "bg-white"}`}>{i + 1}. {f.nome}</button>
        ))}
      </div>
      <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-3xl border-4 border-ink bg-white p-4">
          <div className="mx-auto grid aspect-square max-w-sm gap-1" style={{ gridTemplateColumns: `repeat(${fase.tamanho}, 1fr)` }} role="img" aria-label={`Tabuleiro ${fase.tamanho} por ${fase.tamanho}: o robô está na coluna ${pos[0] + 1}, linha ${pos[1] + 1}; a estrela na coluna ${fase.estrela[0] + 1}, linha ${fase.estrela[1] + 1}.`}>
            {Array.from({ length: fase.tamanho * fase.tamanho }, (_, k) => {
              const x = k % fase.tamanho;
              const y = Math.floor(k / fase.tamanho);
              return (
                <div key={k} className={`relative rounded-md ${parede(x, y) ? "bg-[#7A5A3A]" : "bg-[#E9F3D8]"}`}>
                  {fase.estrela[0] === x && fase.estrela[1] === y && <span className="absolute inset-0 flex items-center justify-center text-2xl">⭐</span>}
                  {pos[0] === x && pos[1] === y && <span className="absolute inset-0 p-0.5"><Robozinho dir={pos[2]} /></span>}
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-center text-lg">💡 {fase.dica}</p>
        </div>
        <div className="rounded-3xl border-4 border-ink bg-white p-4">
          <p className="text-xl font-bold">Blocos</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["andar", "esquerda", "direita"] as const).map((b) => (
              <button key={b} type="button" disabled={estado === "rodando"} onClick={() => setBlocos([...blocos, { tipo: b }])} className="min-h-12 cursor-pointer rounded-xl border-4 border-ink bg-[#FFF4D6] px-3 text-lg font-bold">{NOMES[b]}</button>
            ))}
          </div>
          {fase.repetir && (
            <div className="mt-3 rounded-xl border-4 border-dashed border-[#7A1F1F] p-3">
              <p className="font-bold">🔁 Repetir
                <select value={vezes} onChange={(e) => setVezes(Number(e.target.value))} className="mx-2 rounded border-2 border-ink px-2 py-1 text-lg">{[2, 3, 4, 5, 6].map((v) => <option key={v}>{v}</option>)}</select>
                vezes:
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(["andar", "esquerda", "direita"] as const).map((b) => <button key={b} type="button" onClick={() => setCorpo([...corpo, b])} className="min-h-10 cursor-pointer rounded-lg border-2 border-ink bg-white px-2">{NOMES[b]}</button>)}
              </div>
              <p className="mt-2 min-h-6">{corpo.map((c) => NOMES[c].split(" ")[0]).join(" ")}</p>
              <button type="button" disabled={corpo.length === 0} onClick={() => { setBlocos([...blocos, { tipo: "repetir", vezes, corpo }]); setCorpo([]); }} className="mt-1 min-h-10 cursor-pointer rounded-lg border-2 border-ink bg-[#7A1F1F] px-3 font-bold text-white disabled:opacity-40">Pôr o Repetir no programa</button>
            </div>
          )}
          <p className="mt-4 text-xl font-bold">Seu programa</p>
          <ol className="mt-2 min-h-24 space-y-1 rounded-xl bg-[#F4F4F4] p-3 text-lg">
            {blocos.map((b, i) => <li key={i}>{i + 1}. {b.tipo === "repetir" ? `🔁 Repetir ${b.vezes}× : ${b.corpo.map((c) => NOMES[c].split(" ")[0]).join(" ")}` : NOMES[b.tipo]}</li>)}
            {blocos.length === 0 && <li className="text-ink-soft">Toque nos blocos para montar.</li>}
          </ol>
          <p className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={blocos.length === 0 || estado === "rodando"} onClick={rodar} className="min-h-14 cursor-pointer rounded-full border-4 border-ink bg-[#2E8B57] px-6 text-xl font-bold text-white disabled:opacity-40">▶ Rodar</button>
            <button type="button" disabled={estado === "rodando"} onClick={() => setBlocos(blocos.slice(0, -1))} className="min-h-14 cursor-pointer rounded-full border-4 border-ink bg-white px-5 text-lg font-bold">⌫ Tirar o último</button>
            <button type="button" disabled={estado === "rodando"} onClick={() => { setBlocos([]); setPos(fase.inicio); setEstado("montando"); }} className="min-h-14 cursor-pointer rounded-full border-4 border-ink bg-white px-5 text-lg font-bold">Começar de novo</button>
          </p>
          <div aria-live="polite" className="mt-3 text-xl">
            {estado === "chegou" && <div className="text-center"><Mascote humor="festa" tamanho={70} /><p className="font-bold">Chegou na estrela! {n < FASES.length - 1 && <button type="button" onClick={() => trocarFase(n + 1)} className="ml-2 cursor-pointer underline">Próxima fase →</button>}</p></div>}
            {estado === "bateu" && <p>Opa, o robozinho bateu! Olhe o caminho e ajuste os blocos. 💛</p>}
            {estado === "parou" && <p>O robozinho parou antes da estrela. Falta um pouquinho!</p>}
          </div>
        </div>
      </div>
      <NotaParaOAdulto idade="8 a 12 anos" objetivo="Montar uma sequência de comandos e corrigir quando não dá certo." aprende="Sequência, direção, a ideia de repetição (laço) e a depuração: achar e consertar o erro." nota="Pergunte o que a criança acha que vai acontecer antes de rodar. Quando o robô bate, é a hora mais rica: o que mudar?" />
    </div>
  );
}
