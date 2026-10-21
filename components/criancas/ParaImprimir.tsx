// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { NotaParaOAdulto } from "./comum";

/** Caça-palavras e labirinto gerados aqui, com semente (o mesmo número dá a mesma folha), para imprimir em A4. */
function sorteador(semente: number) {
  let s = (Math.abs(Math.floor(semente)) % 2147483646) + 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const TEMAS: Record<string, string[]> = {
  Frutas: ["MANGA", "UVA", "CAJU", "BANANA", "PERA", "GOIABA", "LIMAO", "MELAO"],
  Animais: ["GATO", "ONCA", "SAPO", "PATO", "ARARA", "MACACO", "TATU", "VACA"],
  Escola: ["LAPIS", "LIVRO", "MESA", "CADERNO", "GIZ", "REGUA", "MOCHILA", "AULA"],
  Natureza: ["RIO", "MAR", "SOL", "LUA", "FLOR", "CHUVA", "ARVORE", "PEDRA"],
};

function cacaPalavras(palavras: string[], tam: number, semente: number) {
  const r = sorteador(semente);
  const grade: string[][] = Array.from({ length: tam }, () => Array<string>(tam).fill(""));
  const direcoes: [number, number][] = [[1, 0], [0, 1], [1, 1]];
  const postas: string[] = [];
  for (const p of palavras) {
    for (let t = 0; t < 200; t++) {
      const [dx, dy] = direcoes[Math.floor(r() * direcoes.length)];
      const x0 = Math.floor(r() * tam);
      const y0 = Math.floor(r() * tam);
      const xf = x0 + dx * (p.length - 1);
      const yf = y0 + dy * (p.length - 1);
      if (xf >= tam || yf >= tam) continue;
      if ([...p].every((c, i) => grade[y0 + dy * i][x0 + dx * i] === "" || grade[y0 + dy * i][x0 + dx * i] === c)) {
        [...p].forEach((c, i) => (grade[y0 + dy * i][x0 + dx * i] = c));
        postas.push(p);
        break;
      }
    }
  }
  const letras = "ABCDEFGHIJLMNOPRSTUV";
  for (const linha of grade) for (let x = 0; x < tam; x++) if (!linha[x]) linha[x] = letras[Math.floor(r() * letras.length)];
  return { grade, postas };
}

/** Labirinto perfeito (um caminho só entre dois pontos) por busca em profundidade, desenhado em SVG. */
function labirinto(w: number, h: number, semente: number) {
  const r = sorteador(semente);
  const paredes = Array.from({ length: h }, () => Array.from({ length: w }, () => ({ n: true, s: true, l: true, o: true })));
  const visto = Array.from({ length: h }, () => Array<boolean>(w).fill(false));
  const pilha: [number, number][] = [[0, 0]];
  visto[0][0] = true;
  while (pilha.length) {
    const [x, y] = pilha[pilha.length - 1];
    const viz = ([[0, -1, "n", "s"], [0, 1, "s", "n"], [1, 0, "l", "o"], [-1, 0, "o", "l"]] as const).filter(([dx, dy]) => {
      const nx = x + dx;
      const ny = y + dy;
      return nx >= 0 && ny >= 0 && nx < w && ny < h && !visto[ny][nx];
    });
    if (!viz.length) {
      pilha.pop();
      continue;
    }
    const [dx, dy, a, b] = viz[Math.floor(r() * viz.length)];
    paredes[y][x][a] = false;
    paredes[y + dy][x + dx][b] = false;
    visto[y + dy][x + dx] = true;
    pilha.push([x + dx, y + dy]);
  }
  return paredes;
}

export function ParaImprimir() {
  const [tipo, setTipo] = useState<"caca" | "labirinto">("caca");
  const [tema, setTema] = useState("Frutas");
  const [tam, setTam] = useState(10);
  const [semente, setSemente] = useState(2026);
  const { grade, postas } = cacaPalavras(TEMAS[tema], tam, semente);
  const lab = labirinto(tam, Math.round(tam * 1.3), semente);
  const c = 20;
  return (
    <div>
      <div className="no-print flex flex-wrap items-end gap-3 rounded-3xl border-4 border-ink bg-white p-4 text-lg">
        <div className="flex gap-2">
          {([["caca", "🔤 Caça-palavras"], ["labirinto", "🌀 Labirinto"]] as const).map(([id, nome]) => (
            <button key={id} type="button" aria-pressed={tipo === id} onClick={() => setTipo(id)} className={`min-h-12 cursor-pointer rounded-full border-4 border-ink px-4 font-bold ${tipo === id ? "bg-ink text-white" : "bg-white"}`}>{nome}</button>
          ))}
        </div>
        {tipo === "caca" && <label>Tema <select value={tema} onChange={(e) => setTema(e.target.value)} className="ml-1 rounded border-2 border-ink px-2 py-1">{Object.keys(TEMAS).map((t) => <option key={t}>{t}</option>)}</select></label>}
        <label>Tamanho <select value={tam} onChange={(e) => setTam(Number(e.target.value))} className="ml-1 rounded border-2 border-ink px-2 py-1"><option value={8}>Pequeno</option><option value={10}>Médio</option><option value={13}>Grande</option></select></label>
        <label>Número da folha <input type="number" value={semente} onChange={(e) => setSemente(Number(e.target.value) || 1)} className="ml-1 w-28 rounded border-2 border-ink px-2 py-1" /></label>
        <button type="button" onClick={() => setSemente(semente + 1)} className="min-h-12 cursor-pointer rounded-full border-4 border-ink bg-white px-4 font-bold">Outra folha</button>
        <button type="button" onClick={() => window.print()} className="min-h-12 cursor-pointer rounded-full border-4 border-ink bg-ink px-5 font-bold text-white">🖨️ Imprimir</button>
      </div>
      <div className="folha-infantil mx-auto mt-6 max-w-[190mm] bg-white p-6 text-black">
        <p className="text-center font-sans text-sm">Cantinho da Lua · Instituto Lúcia · folha nº {semente}</p>
        {tipo === "caca" ? (
          <>
            <h2 className="mt-2 text-center text-3xl font-bold">Caça-palavras: {tema}</h2>
            <table className="mx-auto mt-4 border-collapse font-mono text-2xl">
              <tbody>{grade.map((linha, y) => <tr key={y}>{linha.map((l, x) => <td key={x} className="h-10 w-10 border border-black/30 text-center">{l}</td>)}</tr>)}</tbody>
            </table>
            <p className="mt-4 text-center text-xl">Encontre: {postas.join(" · ")}</p>
            <p className="mt-1 text-center text-sm">As palavras estão na horizontal, na vertical e na diagonal (sem acento).</p>
          </>
        ) : (
          <>
            <h2 className="mt-2 text-center text-3xl font-bold">Labirinto</h2>
            <p className="text-center">Leve a Lua (🌙 em cima) até a estrela (⭐ embaixo)!</p>
            <svg viewBox={`-4 -4 ${tam * c + 8} ${lab.length * c + 8}`} className="mx-auto mt-3 w-full max-w-[160mm]" role="img" aria-label="Labirinto para imprimir">
              {lab.map((linha, y) => linha.map((p, x) => (
                <g key={`${x}-${y}`} stroke="#000" strokeWidth="2.2" strokeLinecap="round">
                  {p.n && !(x === 0 && y === 0) && <line x1={x * c} y1={y * c} x2={(x + 1) * c} y2={y * c} />}
                  {p.o && <line x1={x * c} y1={y * c} x2={x * c} y2={(y + 1) * c} />}
                  {p.s && !(x === tam - 1 && y === lab.length - 1) && <line x1={x * c} y1={(y + 1) * c} x2={(x + 1) * c} y2={(y + 1) * c} />}
                  {p.l && <line x1={(x + 1) * c} y1={y * c} x2={(x + 1) * c} y2={(y + 1) * c} />}
                </g>
              )))}
              <text x={c / 2} y={c * 0.72} fontSize={c * 0.7} textAnchor="middle">🌙</text>
              <text x={(tam - 0.5) * c} y={(lab.length - 0.28) * c} fontSize={c * 0.7} textAnchor="middle">⭐</text>
            </svg>
          </>
        )}
      </div>
      <div className="no-print">
        <NotaParaOAdulto idade="4 a 12 anos" objetivo="Atividades de papel para fazer longe da tela." aprende="Atenção, leitura de palavras, orientação espacial e paciência." nota="Imprima em A4, de preferência em preto e branco (gasta pouca tinta). O número da folha refaz a mesma atividade: bom para a turma inteira fazer igual." />
      </div>
    </div>
  );
}
