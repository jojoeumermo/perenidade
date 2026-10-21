// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { corteRC, emParalelo, emSerie, faixasDoResistor, ganhoRC, minimizar } from "@/lib/ferramentas/rodada";
import { Bancada, BotaoClaro, Escolha, Leitura } from "../../labs/kit";
import { ComoUsar } from "./comum";

const CORES = [["preto", "#1a1a1a"], ["marrom", "#7a4a1e"], ["vermelho", "#c62828"], ["laranja", "#ef7d00"], ["amarelo", "#f5d000"], ["verde", "#2e7d32"], ["azul", "#1e56c8"], ["violeta", "#7b3fa0"], ["cinza", "#8a8a8a"], ["branco", "#f4f4f4"]] as const;
const DOURADO = ["dourado", "#c9a227"] as const;
const num = (x: number, c = 3) => (Number.isFinite(x) ? x.toLocaleString("pt-BR", { maximumFractionDigits: c }) : "—");
function ohms(v: number) {
  if (!Number.isFinite(v)) return "—";
  if (v >= 1e6) return `${num(v / 1e6)} MΩ`;
  if (v >= 1e3) return `${num(v / 1e3)} kΩ`;
  return `${num(v)} Ω`;
}
function hz(v: number) {
  if (v >= 1e6) return `${num(v / 1e6, 2)} MHz`;
  if (v >= 1e3) return `${num(v / 1e3, 2)} kHz`;
  return `${num(v, 1)} Hz`;
}
/** Lê "4k7", "4,7k", "2M2", "470" e devolve em ohms. */
function lerValor(t: string) {
  const s = t.trim().replace(",", ".").toLowerCase().replace(/\s|ω|ohms?/g, "");
  const m = /^(\d*\.?\d+)([kmr]?)(\d*)$/.exec(s);
  if (!m) return NaN;
  const mult = m[2] === "k" ? 1e3 : m[2] === "m" ? 1e6 : 1;
  return Number(m[3] ? `${m[1]}.${m[3]}` : m[1]) * mult;
}

function Resistor({ faixas }: { faixas: string[] }) {
  return (
    <svg viewBox="0 0 260 60" className="h-14 w-full max-w-xs" role="img" aria-label={`Resistor com as faixas ${faixas.join(", ")}`}>
      <line x1="0" y1="30" x2="260" y2="30" stroke="#999" strokeWidth="4" />
      <rect x="55" y="12" width="150" height="36" rx="16" fill="#d9c08f" stroke="#8a7550" strokeWidth="2" />
      {faixas.map((c, i) => <rect key={i} x={i < 3 ? 75 + i * 24 : 175} y="12" width="12" height="36" fill={c} />)}
    </svg>
  );
}

const ORDEM_GRAY = [0, 1, 3, 2];

/** Calculadoras de eletrônica: código de cores (nos dois sentidos), série e paralelo, divisor, filtro RC e Karnaugh. */
export function CalculadorasDeEletronica() {
  const [aba, setAba] = useState<"cores" | "associacao" | "divisor" | "rc" | "karnaugh">("cores");
  const [valor, setValor] = useState("4k7");
  const [bandas, setBandas] = useState([1, 0, 2]);
  const [lista, setLista] = useState("220, 330, 1k");
  const [div, setDiv] = useState({ vin: "12", r1: "10k", r2: "4k7" });
  const [rc, setRc] = useState({ r: "1k", c: "1", unidade: "µF", tipo: "baixa" as "baixa" | "alta" });
  const [vars, setVars] = useState<2 | 3 | 4>(3);
  const [celulas, setCelulas] = useState<Record<number, 0 | 1 | 2>>({ 1: 1, 3: 1, 5: 1, 6: 1, 7: 1 });
  const fx = faixasDoResistor(lerValor(valor));
  const rs = lista.split(/[;,\s]+/).map(lerValor).filter((x) => x > 0);
  const vin = Number(div.vin.replace(",", ".")), r1 = lerValor(div.r1), r2 = lerValor(div.r2);
  const c = Number(rc.c.replace(",", ".")) * ({ pF: 1e-12, nF: 1e-9, "µF": 1e-6 } as Record<string, number>)[rc.unidade];
  const fc = corteRC(lerValor(rc.r), c);
  const minis = Object.entries(celulas).filter(([, v]) => v === 1).map(([k]) => Number(k));
  const tanto = Object.entries(celulas).filter(([, v]) => v === 2).map(([k]) => Number(k));
  const linhasK = vars === 2 ? [0, 1] : vars === 3 ? [0, 1] : ORDEM_GRAY;
  const colunasK = vars === 2 ? [0, 1] : ORDEM_GRAY;
  const bitsLinha = vars === 4 ? 2 : 1;
  const bitsColuna = vars === 2 ? 1 : 2;
  const rotulo = (x: number, n: number) => x.toString(2).padStart(n, "0");
  const letras = ["A", "B", "C", "D"].slice(0, vars);
  const campo = "mt-1 w-full border-2 border-ink/30 bg-parchment px-2 py-1.5 font-mono";
  return (
    <div>
      <Bancada titulo="Calculadoras de eletrônica" subtitulo="As contas da bancada, com a fórmula ao lado">
        <Escolha rotulo="Calculadora" valor={aba} opcoes={[["cores", "Código de cores"], ["associacao", "Série e paralelo"], ["divisor", "Divisor de tensão"], ["rc", "Filtro RC"], ["karnaugh", "Mapa de Karnaugh"]]} mudar={setAba} />
        {aba === "cores" && (
          <div className="mt-4 grid gap-6 md:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold">Valor → cores (ex.: 4k7, 220, 1M)<input value={valor} onChange={(e) => setValor(e.target.value.slice(0, 12))} className={campo} /></label>
              {fx ? <><Resistor faixas={[CORES[fx.d1][1], CORES[fx.d2][1], fx.mult >= 0 ? CORES[fx.mult][1] : DOURADO[1], DOURADO[1]]} /><p className="text-sm">{CORES[fx.d1][0]}, {CORES[fx.d2][0]}, {fx.mult >= 0 ? CORES[fx.mult][0] : "dourado (÷10)"} e dourado (±5%) = <strong>{ohms(fx.valor)}</strong></p></> : <p className="mt-2 text-sm text-oxblood">Valor fora do código de 4 faixas.</p>}
            </div>
            <div>
              <p className="text-sm font-semibold">Cores → valor</p>
              <div className="mt-1 grid grid-cols-3 gap-2">
                {["1º algarismo", "2º algarismo", "multiplicador"].map((r, i) => (
                  <label key={r} className="text-xs">{r}<select value={bandas[i]} onChange={(e) => setBandas((b) => b.map((x, j) => (j === i ? Number(e.target.value) : x)))} className="mt-1 w-full border-2 border-ink/30 bg-parchment">{CORES.map(([nome], k) => <option key={nome} value={k}>{nome} ({i < 2 ? k : `×${10 ** k}`})</option>)}</select></label>
                ))}
              </div>
              <Resistor faixas={[CORES[bandas[0]][1], CORES[bandas[1]][1], CORES[bandas[2]][1], DOURADO[1]]} />
              <p className="text-sm">({bandas[0]}{bandas[1]}) × 10^{bandas[2]} = <strong>{ohms((bandas[0] * 10 + bandas[1]) * 10 ** bandas[2])}</strong> ±5%</p>
            </div>
          </div>
        )}
        {aba === "associacao" && (
          <div className="mt-4 max-w-xl">
            <label className="block text-sm font-semibold">Resistores (separe por vírgula; aceita 4k7, 1M)<input value={lista} onChange={(e) => setLista(e.target.value.slice(0, 120))} className={campo} /></label>
            <div className="mt-3 grid grid-cols-2 gap-2"><Leitura rotulo="Em série (somam)" valor={ohms(emSerie(rs))} /><Leitura rotulo="Em paralelo" valor={ohms(emParalelo(rs))} /></div>
            <p className="mt-2 font-mono text-xs">Série: R = R1 + R2 + … · Paralelo: 1/R = 1/R1 + 1/R2 + … (o total fica menor que o menor deles)</p>
          </div>
        )}
        {aba === "divisor" && (
          <div className="mt-4 grid max-w-2xl gap-4 sm:grid-cols-[1fr_auto]">
            <div className="grid grid-cols-3 gap-2 text-sm">
              <label>Entrada (V)<input value={div.vin} onChange={(e) => setDiv({ ...div, vin: e.target.value })} className={campo} /></label>
              <label>R1 (em cima)<input value={div.r1} onChange={(e) => setDiv({ ...div, r1: e.target.value })} className={campo} /></label>
              <label>R2 (embaixo)<input value={div.r2} onChange={(e) => setDiv({ ...div, r2: e.target.value })} className={campo} /></label>
              <p className="col-span-3 font-mono text-xs">Vsaída = Ventrada × R2 ÷ (R1 + R2)</p>
            </div>
            <Leitura rotulo="Saída" valor={`${num((vin * r2) / (r1 + r2), 2)} V`} />
          </div>
        )}
        {aba === "rc" && (
          <div className="mt-4">
            <div className="flex flex-wrap items-end gap-3 text-sm">
              <label>R<input value={rc.r} onChange={(e) => setRc({ ...rc, r: e.target.value })} className={`${campo} w-24`} /></label>
              <label>C<input value={rc.c} onChange={(e) => setRc({ ...rc, c: e.target.value })} className={`${campo} w-20`} /></label>
              <select value={rc.unidade} onChange={(e) => setRc({ ...rc, unidade: e.target.value })} aria-label="Unidade do capacitor" className="border-2 border-ink/30 bg-parchment py-1.5"><option>pF</option><option>nF</option><option>µF</option></select>
              <Escolha rotulo="Filtro" valor={rc.tipo} opcoes={[["baixa", "Passa-baixa"], ["alta", "Passa-alta"]]} mudar={(v) => setRc({ ...rc, tipo: v })} />
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3"><Leitura rotulo="Frequência de corte" valor={Number.isFinite(fc) ? hz(fc) : "—"} destaque /><Leitura rotulo="Fórmula" valor="1 ÷ (2πRC)" /><Leitura rotulo="No corte, o sinal cai para" valor="70,7%" /></div>
            {Number.isFinite(fc) && (
              <svg viewBox="0 0 400 140" className="mt-3 w-full rounded bg-[#0f1a14]" role="img" aria-label={`Resposta do filtro ${rc.tipo === "baixa" ? "passa-baixa" : "passa-alta"} com corte em ${hz(fc)}`}>
                {[0.25, 0.5, 0.707, 1].map((g) => <line key={g} x1="0" x2="400" y1={120 - g * 100} y2={120 - g * 100} stroke={g === 0.707 ? "#ffd27a55" : "#2c4a3a"} />)}
                <polyline fill="none" stroke="#3ad17a" strokeWidth="2.5" points={Array.from({ length: 101 }, (_, i) => { const f = fc * 10 ** ((i - 50) / 25); return `${i * 4},${120 - ganhoRC(rc.tipo, f, fc) * 100}`; }).join(" ")} />
                <line x1="200" x2="200" y1="10" y2="130" stroke="#ffd27a" strokeDasharray="3 3" />
                <text x="204" y="20" fontSize="10" fill="#ffd27a">corte</text>
                <text x="2" y="136" fontSize="9" fill="#7fb59a">{hz(fc / 100)}</text><text x="345" y="136" fontSize="9" fill="#7fb59a">{hz(fc * 100)}</text>
              </svg>
            )}
            <p className="mt-2 text-xs text-ink-soft">{rc.tipo === "baixa" ? "Passa-baixa: deixa passar os graves e corta os agudos (o capacitor vai para a terra)." : "Passa-alta: deixa passar os agudos e barra os graves (o capacitor fica em série com o sinal)."} Escala de frequência em décadas.</p>
          </div>
        )}
        {aba === "karnaugh" && (
          <div className="mt-4">
            <Escolha rotulo="Variáveis" valor={String(vars)} opcoes={[["2", "2 (A, B)"], ["3", "3 (A, B, C)"], ["4", "4 (A, B, C, D)"]]} mudar={(v) => { setVars(Number(v) as 2 | 3 | 4); setCelulas({}); }} />
            <p className="mt-2 text-sm">Toque nas casas: 0 → 1 → X (“não importa”) → 0. As linhas e colunas seguem a ordem de Gray (00, 01, 11, 10): vizinhas mudam um bit só.</p>
            <table className="mt-3 border-collapse font-mono">
              <thead><tr><th className="p-1 text-xs">{letras.slice(0, bitsLinha).join("")}\{letras.slice(bitsLinha).join("")}</th>{colunasK.map((cK) => <th key={cK} className="p-1 text-xs">{rotulo(cK, bitsColuna)}</th>)}</tr></thead>
              <tbody>
                {linhasK.map((l) => (
                  <tr key={l}>
                    <th className="p-1 text-xs">{rotulo(l, bitsLinha)}</th>
                    {colunasK.map((cK) => {
                      const m = (l << bitsColuna) | cK;
                      const v = celulas[m] ?? 0;
                      return <td key={cK} className="p-0.5"><button type="button" onClick={() => setCelulas((x) => ({ ...x, [m]: ((v + 1) % 3) as 0 | 1 | 2 }))} aria-label={`Mintermo ${m}: ${v === 2 ? "não importa" : v}`} className={`h-12 w-12 cursor-pointer border-2 border-ink text-lg font-bold ${v === 1 ? "bg-[#ffd27a]" : v === 2 ? "bg-parchment-deep text-ink-soft" : "bg-parchment"}`}>{v === 2 ? "X" : v}<span className="block text-[0.55rem] font-normal text-ink-soft">m{m}</span></button></td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Leitura rotulo="Expressão mínima (soma de produtos)" valor={minimizar(vars, minis, tanto)} destaque />
              <Leitura rotulo="Mintermos" valor={minis.length ? `Σm(${minis.sort((a, b) => a - b).join(", ")})` : "—"} />
            </div>
            <p className="mt-2 text-xs text-ink-soft">{"A'"} quer dizer “não A”. Os grupos de 1, 2, 4 ou 8 casas vizinhas (inclusive pelas bordas) somem com a variável que muda dentro do grupo.</p>
            <div className="mt-2"><BotaoClaro onClick={() => setCelulas({})}>Limpar</BotaoClaro></div>
          </div>
        )}
      </Bancada>
      <ComoUsar
        passos={["Escolha a calculadora no alto.", "Digite os valores como na bancada: 4k7 é 4,7 kΩ; 2M2 é 2,2 MΩ.", "Leia o resultado e a fórmula; no Karnaugh, toque nas casas para marcar os 1."]}
        atividades={["Pegue um resistor de verdade (ou de uma placa velha), leia as cores e confira o valor aqui. Depois meça com o multímetro do laboratório de elétrica.", "Que dois resistores em paralelo dão cerca de 50 Ω? E em série, que três dão 1 kΩ?", "No Karnaugh de 3 variáveis, marque m1, m3, m5, m6 e m7. Explique por que a expressão mínima é C + AB."]}
      />
    </div>
  );
}
