// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { fill } from "@/i18n/config";
import { criarSorteio, sementeNova } from "@/lib/jogos/base";
import { bloqueDa, conflitos, gerarSudoku, type Sudoku, type Tamanho } from "@/lib/jogos/sudoku";
import { Acoes, Aviso, Botao, Opcoes, Quadro, type PropsDoJogo } from "./comum";

const novoJogo = (tamanho: Tamanho, dif: "facil" | "medio") => gerarSudoku(tamanho, dif, criarSorteio(sementeNova()));

/** Sudoku de 4x4, 6x6 ou 9x9 com solução única. Escolha a casa, depois o número (ou digite o número). */
export function SudokuJogo({ s }: PropsDoJogo) {
  const [tamanho, setTamanho] = useState<Tamanho>(4);
  const [dif, setDif] = useState<"facil" | "medio">("facil");
  const [jogo, setJogo] = useState<Sudoku>(() => novoJogo(4, "facil"));
  const [grade, setGrade] = useState<number[]>(() => jogo.dadas);
  const [sel, setSel] = useState<number | null>(null);
  const [marcar, setMarcar] = useState(false);
  const [aviso, setAviso] = useState("");
  const t = s.sudoku;
  const n = jogo.medida.n;

  const novo = (tam = tamanho, d = dif) => {
    const j = novoJogo(tam, d);
    setJogo(j);
    setGrade(j.dadas);
    setSel(null);
    setMarcar(false);
    setAviso("");
  };
  const repetidos = conflitos(jogo.medida, grade);
  const resolvido = grade.every((v, i) => v === jogo.solucao[i]);

  const por = (valor: number) => {
    if (sel === null || jogo.dadas[sel]) return;
    const nova = [...grade];
    nova[sel] = valor;
    setGrade(nova);
    setMarcar(false);
    setAviso(nova.every((v, i) => v === jogo.solucao[i]) ? t.resolvido : "");
  };
  const conferir = () => {
    setMarcar(true);
    setAviso(resolvido ? t.resolvido : repetidos.size ? t.repetidos : t.tudoCerto);
  };
  const dica = () => {
    const vazias = grade.map((v, i) => (v === 0 || v !== jogo.solucao[i] ? i : -1)).filter((i) => i >= 0);
    if (!vazias.length) return;
    const i = sel !== null && vazias.includes(sel) ? sel : vazias[0];
    const nova = [...grade];
    nova[i] = jogo.solucao[i];
    setGrade(nova);
    setSel(i);
    setAviso(t.dicaFeita);
  };
  const aoTecla = (e: React.KeyboardEvent, i: number) => {
    const r = Math.floor(i / n);
    const c = i % n;
    const mapa: Record<string, [number, number]> = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] };
    if (mapa[e.key]) {
      e.preventDefault();
      const rr = Math.max(0, Math.min(n - 1, r + mapa[e.key][0]));
      const cc = Math.max(0, Math.min(n - 1, c + mapa[e.key][1]));
      setSel(rr * n + cc);
      (e.currentTarget.parentElement?.children[rr * n + cc] as HTMLElement | undefined)?.focus();
    } else if (/^[1-9]$/.test(e.key) && Number(e.key) <= n) por(Number(e.key));
    else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") por(0);
  };
  const lado = n === 9 ? "2.1rem" : n === 6 ? "2.8rem" : "3.4rem";

  return (
    <Quadro>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <Opcoes nome={s.comum.tamanho} valor={tamanho} opcoes={[[4, "4x4"], [6, "6x6"], [9, "9x9"]]} aoEscolher={(v) => { setTamanho(v as Tamanho); novo(v as Tamanho); }} />
        <Opcoes nome={s.comum.dificuldade} valor={dif} opcoes={[["facil", s.comum.facil], ["medio", s.comum.medio]]} aoEscolher={(v) => { setDif(v); novo(tamanho, v); }} />
      </div>
      <p className="mt-3 max-w-2xl text-sm text-ink-soft">{t.instrucao}</p>
      <div className="mt-4 overflow-x-auto pb-2">
        <div role="group" aria-label="Sudoku" className="grid w-max border-2 border-ink" style={{ gridTemplateColumns: `repeat(${n}, ${lado})` }}>
          {grade.map((v, i) => {
            const r = Math.floor(i / n);
            const c = i % n;
            const dada = jogo.dadas[i] !== 0;
            const ruim = repetidos.has(i) || (marcar && v !== 0 && v !== jogo.solucao[i]);
            const grosso = (c + 1) % jogo.medida.bc === 0 && c < n - 1 ? "border-r-2 border-r-ink" : "border-r border-r-rule";
            const grossoB = (r + 1) % jogo.medida.bl === 0 && r < n - 1 ? "border-b-2 border-b-ink" : "border-b border-b-rule";
            return (
              <button
                key={i}
                type="button"
                tabIndex={sel === i || (sel === null && i === 0) ? 0 : -1}
                aria-label={`${fill(t.casa, { r: r + 1, c: c + 1 })}: ${v ? v : t.vazia}${dada ? `, ${t.dada}` : ""}${ruim ? `, ${t.conflito}` : ""}`}
                aria-pressed={sel === i}
                onClick={() => setSel(i)}
                onKeyDown={(e) => aoTecla(e, i)}
                style={{ height: lado }}
                className={`cursor-pointer text-center font-mono text-lg focus:outline-2 focus:-outline-offset-2 focus:outline-prelo-texto ${grosso} ${grossoB} ${sel === i ? "bg-[#f0b323]/60" : ruim ? "bg-[#fde8e6]" : bloqueDa(jogo.medida, r, c) % 2 ? "bg-parchment-deep" : "bg-white"} ${dada ? "font-extrabold text-ink" : "font-medium text-prelo-texto"} ${ruim ? "text-[#c21f16]!" : ""}`}
              >
                {v || ""}
              </button>
            );
          })}
        </div>
      </div>
      <div role="group" aria-label={t.numeros} className="mt-3 flex flex-wrap gap-1.5">
        {Array.from({ length: n }, (_, k) => k + 1).map((k) => (
          <button key={k} type="button" onClick={() => por(k)} className="botao min-w-10 cursor-pointer">{k}</button>
        ))}
        <Botao onClick={() => por(0)}>{t.apagarCasa}</Botao>
      </div>
      <Acoes>
        <Botao onClick={conferir}>{s.comum.conferir}</Botao>
        <Botao onClick={dica}>{s.comum.dica}</Botao>
        <Botao onClick={() => { setGrade(jogo.solucao); setAviso(""); }}>{s.comum.mostrar}</Botao>
        <Botao onClick={() => novo()}>{s.comum.novo}</Botao>
      </Acoes>
      <Aviso>{aviso}</Aviso>
    </Quadro>
  );
}
