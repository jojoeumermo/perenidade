// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useMemo, useState } from "react";
import { candidatos, dicaSudoku, gerarSudoku, NIVEIS } from "@/lib/ferramentas/rodada";
import { Bancada, BotaoClaro, Escolha } from "../../labs/kit";
import { ComoUsar } from "./comum";

type Nivel = keyof typeof NIVEIS;

/** Sudoku com gerador próprio (solução única), três níveis, dicas que explicam e notas a lápis. Sem placar nem ranking. */
export function Sudoku() {
  const [nivel, setNivel] = useState<Nivel>("facil");
  // A primeira partida é sempre a mesma (o servidor e o navegador desenham igual); "Jogo novo" sorteia.
  const [semente, setSemente] = useState(2026);
  const { jogo, solucao } = useMemo(() => gerarSudoku(semente, nivel), [semente, nivel]);
  const [grade, setGrade] = useState<number[]>(jogo);
  const [base, setBase] = useState(jogo);
  const [sel, setSel] = useState<number | null>(null);
  const [lapis, setLapis] = useState(false);
  const [notas, setNotas] = useState<Record<number, number[]>>({});
  const [aviso, setAviso] = useState("");
  const [mostrarErros, setMostrarErros] = useState(false);
  // Jogo novo: a grade volta ao começo (comparando a referência, sem efeito).
  if (base !== jogo) { setBase(jogo); setGrade(jogo); setNotas({}); setSel(null); setAviso(""); }
  const fixa = (i: number) => jogo[i] !== 0;
  const por = (d: number) => {
    if (sel === null || fixa(sel)) return;
    if (lapis && d) { setNotas((n) => ({ ...n, [sel]: n[sel]?.includes(d) ? n[sel].filter((x) => x !== d) : [...(n[sel] ?? []), d].sort() })); return; }
    setGrade((g) => g.map((x, i) => (i === sel ? d : x)));
  };
  const completo = grade.every((x, i) => x === solucao[i]);
  const vazias = grade.filter((x) => !x).length;
  const conflito = (i: number) => grade[i] !== 0 && !fixa(i) && (() => { const g = [...grade]; const d = g[i]; g[i] = 0; return !candidatos(g, i).includes(d); })();
  return (
    <div>
      <Bancada titulo="Sudoku" subtitulo="Lógica pura: cada linha, coluna e quadrado tem de 1 a 9, sem repetir">
        <div className="flex flex-wrap items-end gap-3">
          <Escolha rotulo="Nível" valor={nivel} opcoes={[["facil", "Fácil"], ["medio", "Médio"], ["dificil", "Difícil"]]} mudar={(v) => { setNivel(v); setSemente(1 + Math.floor(Math.random() * 1e6)); }} />
          <BotaoClaro onClick={() => setSemente(1 + Math.floor(Math.random() * 1e6))}>Jogo novo</BotaoClaro>
        </div>
        <div className="mt-4 grid gap-5 lg:grid-cols-[auto_1fr]">
          <div role="grid" aria-label="Tabuleiro do sudoku" className="grid w-full max-w-[26rem] grid-cols-9 border-[3px] border-ink bg-ink" onKeyDown={(e) => { if (/^[1-9]$/.test(e.key)) por(Number(e.key)); else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") por(0); else if (sel !== null && e.key.startsWith("Arrow")) { e.preventDefault(); const d = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 }[e.key] ?? 0; setSel((s) => Math.min(80, Math.max(0, (s ?? 0) + d))); } }}>
            {grade.map((x, i) => {
              const l = Math.floor(i / 9), c = i % 9;
              const mesmaArea = sel !== null && (Math.floor(sel / 9) === l || sel % 9 === c || (Math.floor(sel / 27) === Math.floor(i / 27) && Math.floor((sel % 9) / 3) === Math.floor(c / 3)));
              const mesmoNumero = sel !== null && grade[sel] !== 0 && grade[sel] === x;
              const errada = mostrarErros && x !== 0 && !fixa(i) && x !== solucao[i];
              return (
                <button key={i} type="button" role="gridcell" aria-label={`Linha ${l + 1}, coluna ${c + 1}: ${x || "vazia"}`} aria-selected={sel === i} onClick={() => setSel(i)}
                  className={`relative aspect-square cursor-pointer text-center font-mono text-lg sm:text-xl ${c % 3 === 2 && c < 8 ? "mr-[2px]" : "mr-px"} ${l % 3 === 2 && l < 8 ? "mb-[2px]" : "mb-px"} ${sel === i ? "bg-[#ffd27a]" : mesmoNumero ? "bg-[#f0d9a8]" : mesmaArea ? "bg-[#efe6d0]" : "bg-parchment"} ${fixa(i) ? "font-bold text-ink" : errada || conflito(i) ? "text-[#c21f16]" : "text-[#1e56c8]"}`}>
                  {x || (notas[i]?.length ? <span className="absolute inset-0 grid grid-cols-3 p-0.5 text-[0.5rem] leading-none text-ink-soft">{[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => <span key={d}>{notas[i].includes(d) ? d : ""}</span>)}</span> : "")}
                </button>
              );
            })}
          </div>
          <div className="space-y-3">
            <div className="grid max-w-xs grid-cols-5 gap-1.5">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => <button key={d} type="button" onClick={() => por(d)} className="cursor-pointer rounded border-2 border-ink bg-parchment py-2 font-mono text-lg font-bold hover:bg-[#ffd27a]">{d}</button>)}
              <button type="button" onClick={() => por(0)} className="cursor-pointer rounded border-2 border-ink/40 py-2 text-sm">apagar</button>
            </div>
            <div className="flex flex-wrap gap-2">
              <BotaoClaro onClick={() => setLapis(!lapis)}>{lapis ? "✏️ Lápis ligado" : "✏️ Lápis (notas)"}</BotaoClaro>
              <BotaoClaro onClick={() => { const d = dicaSudoku(grade, solucao); if (d) { setSel(d.casa); setAviso(`Dica para a linha ${Math.floor(d.casa / 9) + 1}, coluna ${(d.casa % 9) + 1}: ${d.motivo}. Pense: que número falta ali?`); } }}>💡 Dica</BotaoClaro>
              <BotaoClaro onClick={() => setMostrarErros(!mostrarErros)}>{mostrarErros ? "Esconder erros" : "Conferir"}</BotaoClaro>
            </div>
            {aviso && <p className="text-sm">{aviso}</p>}
            <p className="text-sm text-ink-soft">{completo ? "✓ Resolvido! Sem pressa e sem placar: quer outro?" : `${vazias} casas vazias. Use o teclado: números, setas e apagar.`}</p>
            {sel !== null && !fixa(sel) && <p className="text-sm">Possíveis nesta casa: <strong>{candidatos(grade.map((x, i) => (i === sel ? 0 : x)), sel).join(", ") || "nenhum: tem algo errado antes"}</strong></p>}
          </div>
        </div>
      </Bancada>
      <ComoUsar
        passos={["Toque numa casa e depois no número (ou use o teclado).", "O lápis guarda possibilidades; a dica aponta a casa mais fácil e explica por quê.", "Conferir mostra em vermelho o que não bate com a solução."]}
        atividades={["Resolva um jogo fácil só olhando as linhas e colunas. Que estratégia você usou?", "Ache uma casa onde só cabe um número e explique para alguém por que é só aquele.", "No médio, use o lápis em todas as casas de um quadrado: o que acontece quando um número só aparece numa casa?"]}
      />
    </div>
  );
}
