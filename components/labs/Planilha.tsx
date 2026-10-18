// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useMemo, useRef, useState } from "react";

const LINHAS = 20;
const COLUNAS = 8;
const COL = (i: number) => String.fromCharCode(65 + i);
type Celulas = Record<string, string>;
const EXEMPLO: Celulas = { A1: "Produto", B1: "Preço", C1: "Qtd", D1: "Total", A2: "Pão", B2: "0.75", C2: "10", D2: "=B2*C2", A3: "Leite", B3: "5.2", C3: "3", D3: "=B3*C3", A4: "Arroz", B4: "6.5", C4: "2", D4: "=B4*C4", A5: "Feijão", B5: "8.9", C5: "1", D5: "=B5*C5", A7: "Soma", D7: "=SOMA(D2:D5)", A8: "Média", D8: "=MÉDIA(D2:D5)", A9: "Caros", D9: '=CONT.SE(B2:B5;">5")', A10: "Preço do arroz", D10: '=PROCV("Arroz";A2:C5;2)', A11: "Passou de 30?", D11: '=SE(D7>30;"sim";"não")' };

/** Expande um intervalo A1:B3 nas células dele. */
function intervalo(ref: string): string[] {
  const m = /^([A-Z])(\d+):([A-Z])(\d+)$/.exec(ref.toUpperCase());
  if (!m) return [ref.toUpperCase()];
  const [, c1, l1, c2, l2] = m;
  const saida: string[] = [];
  for (let c = c1.charCodeAt(0); c <= c2.charCodeAt(0); c++) for (let l = Number(l1); l <= Number(l2); l++) saida.push(`${String.fromCharCode(c)}${l}`);
  return saida;
}

/** Calcula uma célula. Fórmulas: + - * / ^, parênteses, SOMA, MÉDIA, MÍN, MÁX, CONT, CONT.SE, SE, PROCV, ARRED. */
function calcular(cels: Celulas, ref: string, pilha: Set<string> = new Set()): number | string {
  const bruto = (cels[ref] ?? "").trim();
  if (!bruto.startsWith("=")) return bruto === "" ? "" : isNaN(Number(bruto)) ? bruto : Number(bruto);
  if (pilha.has(ref)) return "#CIRCULAR";
  pilha.add(ref);
  const valor = (r: string): number | string => calcular(cels, r, new Set(pilha));
  const nums = (args: string): number[] => args.split(";").flatMap((a) => intervalo(a.trim())).map(valor).filter((v): v is number => typeof v === "number");
  const cond = (c: string) => {
    const m = /^(>=|<=|<>|>|<|=)?(.*)$/.exec(c.replace(/^"|"$/g, ""))!;
    const op = m[1] ?? "=";
    const alvo = isNaN(Number(m[2])) ? m[2] : Number(m[2]);
    return (v: number | string) => (op === ">" ? v > alvo : op === "<" ? v < alvo : op === ">=" ? v >= alvo : op === "<=" ? v <= alvo : op === "<>" ? v != alvo : v == alvo);
  };
  try {
    let expr = bruto.slice(1).toUpperCase().replace(/MEDIA/g, "MÉDIA").replace(/MIN\(/g, "MÍN(").replace(/MAX\(/g, "MÁX(");
    // Funções (de dentro para fora).
    for (let i = 0; i < 20 && /[A-ZÉÍÁ.]+\(/.test(expr); i++) {
      expr = expr.replace(/([A-ZÉÍÁ.]+)\(([^()]*)\)/, (_m, f: string, args: string) => {
        const a = args.split(";").map((x) => x.trim());
        switch (f) {
          case "SOMA": return String(nums(args).reduce((s, n) => s + n, 0));
          case "MÉDIA": { const n = nums(args); return String(n.length ? n.reduce((s, x) => s + x, 0) / n.length : 0); }
          case "MÍN": return String(Math.min(...nums(args)));
          case "MÁX": return String(Math.max(...nums(args)));
          case "CONT": return String(nums(args).length);
          case "CONT.SE": { const t = cond(a[1] ?? ""); return String(intervalo(a[0]).map(valor).filter((v) => v !== "" && t(v)).length); }
          case "ARRED": return String(Number(Number(evalExpr(a[0])).toFixed(Number(a[1] ?? 0))));
          case "SE": { const r = evalExpr(a[0]); return String(r ? (a[1] ?? "").replace(/^"|"$/g, "") : (a[2] ?? "").replace(/^"|"$/g, "")); }
          case "PROCV": {
            const chave = a[0].replace(/^"|"$/g, "");
            const m = /^([A-Z])(\d+):([A-Z])(\d+)$/.exec(a[1]);
            if (!m) return "#REF";
            const col = Number(a[2]) - 1;
            for (let l = Number(m[2]); l <= Number(m[4]); l++) {
              const v = valor(`${m[1]}${l}`);
              if (String(v).toUpperCase() === chave.toUpperCase()) return String(valor(`${String.fromCharCode(m[1].charCodeAt(0) + col)}${l}`));
            }
            return "#N/D";
          }
          default: return "#NOME?";
        }
      });
    }
    return evalExpr(expr);
  } catch {
    return "#ERRO";
  }
  function evalExpr(e: string): number | string {
    if (/^#/.test(e)) return e;
    // Comparações devolvem 1/0.
    const comp = /^(.+?)(>=|<=|<>|>|<|=)(.+)$/.exec(e);
    if (comp && !/^"/.test(e)) { const x = evalExpr(comp[1]); const y = evalExpr(comp[3]); const op = comp[2]; return (op === ">" ? x > y : op === "<" ? x < y : op === ">=" ? x >= y : op === "<=" ? x <= y : op === "<>" ? x != y : x == y) ? 1 : 0; }
    if (/^"[^"]*"$/.test(e.trim())) return e.trim().slice(1, -1);
    const subst = e.replace(/\b([A-Z])(\d+)\b/g, (_m, c: string, l: string) => { const v = valor(`${c}${l}`); return typeof v === "number" ? String(v) : v === "" ? "0" : "NaN"; });
    if (!/^[\d\s+\-*/^().,eE]+$/.test(subst)) return "#VALOR";
    const r = Function(`"use strict"; return (${subst.replace(/\^/g, "**").replace(/,/g, ".")});`)() as number;
    return Number.isFinite(r) ? Math.round(r * 1e10) / 1e10 : "#DIV/0";
  }
}

/** Uma planilha pequena no navegador: fórmulas básicas, gráfico de barras e CSV. Fica só neste aparelho. */
export function Planilha() {
  const [cels, setCels] = useState<Celulas>(() => {
    try {
      return JSON.parse(window.localStorage.getItem("lucia:planilha") ?? "null") ?? EXEMPLO;
    } catch {
      return EXEMPLO;
    }
  });
  const [ativa, setAtiva] = useState("A1");
  const [grafico, setGrafico] = useState("D2:D5");
  const arquivo = useRef<HTMLInputElement>(null);
  const valores = useMemo(() => { const v: Record<string, number | string> = {}; for (const k of Object.keys(cels)) v[k] = calcular(cels, k); return v; }, [cels]);
  const mudar = (ref: string, texto: string) => setCels((c) => { const n = { ...c }; if (texto === "") delete n[ref]; else n[ref] = texto; try { window.localStorage.setItem("lucia:planilha", JSON.stringify(n)); } catch { /* sem armazenamento */ } return n; });
  const barras = intervalo(grafico).map((r) => ({ r, v: typeof valores[r] === "number" ? (valores[r] as number) : 0, rotulo: String(valores[`A${r.slice(1)}`] ?? r) }));
  const maior = Math.max(1, ...barras.map((b) => b.v));
  function exportarCsv() {
    const linhas = Array.from({ length: LINHAS }, (_, l) => Array.from({ length: COLUNAS }, (_, c) => { const v = valores[`${COL(c)}${l + 1}`]; const s = v === undefined ? "" : String(v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(";"));
    while (linhas.length && linhas[linhas.length - 1].replace(/;/g, "") === "") linhas.pop();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + linhas.join("\n")], { type: "text/csv;charset=utf-8" }));
    a.download = "planilha.csv";
    a.click();
  }
  async function importarCsv(f: File | undefined) {
    if (!f) return;
    const texto = await f.text();
    const sep = texto.includes(";") ? ";" : ",";
    const novas: Celulas = {};
    texto.split(/\r?\n/).slice(0, LINHAS).forEach((linha, l) => linha.split(sep).slice(0, COLUNAS).forEach((v, c) => { const limpo = v.replace(/^"|"$/g, "").replace(/""/g, '"'); if (limpo) novas[`${COL(c)}${l + 1}`] = limpo; }));
    setCels(novas);
  }
  const ativaTexto = cels[ativa] ?? "";
  return (
    <div className="mt-6 font-sans text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-10 border border-rule bg-parchment-deep px-2 py-1 text-center font-mono">{ativa}</span>
        <input value={ativaTexto} onChange={(e) => mudar(ativa, e.target.value)} placeholder="valor ou =fórmula" className="min-w-0 flex-1 border-2 border-ink bg-parchment-deep px-2 py-1 font-mono" />
        <button type="button" className="cursor-pointer border-2 border-ink px-3 py-1 font-semibold hover:border-oxblood" onClick={exportarCsv}>Baixar CSV</button>
        <button type="button" className="cursor-pointer border-2 border-ink px-3 py-1 font-semibold hover:border-oxblood" onClick={() => arquivo.current?.click()}>Abrir CSV</button>
        <input ref={arquivo} type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => { void importarCsv(e.target.files?.[0]); e.target.value = ""; }} />
        <button type="button" className="cursor-pointer underline" onClick={() => setCels(EXEMPLO)}>Exemplo</button>
        <button type="button" className="cursor-pointer underline" onClick={() => setCels({})}>Limpar</button>
      </div>
      <div className="mt-3 overflow-x-auto border-2 border-ink">
        <table className="border-collapse font-mono text-xs">
          <thead><tr><th className="w-8 bg-parchment-deep" />{Array.from({ length: COLUNAS }, (_, c) => <th key={c} className="border-l border-rule bg-parchment-deep px-2 py-1 font-semibold">{COL(c)}</th>)}</tr></thead>
          <tbody>
            {Array.from({ length: LINHAS }, (_, l) => (
              <tr key={l}>
                <th className="border-t border-rule bg-parchment-deep px-1 text-ink-soft">{l + 1}</th>
                {Array.from({ length: COLUNAS }, (_, c) => {
                  const ref = `${COL(c)}${l + 1}`;
                  const v = valores[ref];
                  return (
                    <td key={ref} className={`border-t border-l border-rule p-0 ${ref === ativa ? "outline outline-2 -outline-offset-1 outline-oxblood" : ""}`}>
                      <input value={ref === ativa ? ativaTexto : v === undefined ? "" : String(v)} onFocus={() => setAtiva(ref)} onChange={(e) => mudar(ref, e.target.value)} aria-label={ref} className={`w-24 bg-transparent px-1.5 py-1 outline-none ${typeof v === "number" ? "text-right" : ""} ${typeof v === "string" && v.startsWith("#") ? "text-oxblood" : ""}`} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-ink-soft">Fórmulas começam com =. Funções: SOMA, MÉDIA, MÍN, MÁX, CONT, CONT.SE, SE, PROCV, ARRED; separador de argumentos “;”. Fica guardada só neste navegador.</p>
      <div className="mt-6">
        <label className="text-xs">Gráfico de barras do intervalo <input value={grafico} onChange={(e) => setGrafico(e.target.value)} className="w-24 border border-rule bg-parchment-deep px-1 font-mono" /></label>
        <div className="mt-2 flex h-40 items-end gap-2 border border-rule bg-parchment-deep p-3">
          {barras.map((b) => (
            <div key={b.r} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${b.rotulo}: ${b.v}`}>
              <span className="text-[0.6rem]">{b.v}</span>
              <div className="w-full bg-oxblood" style={{ height: `${(b.v / maior) * 100}%` }} />
              <span className="truncate font-mono text-[0.6rem] text-ink-soft">{b.rotulo}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
