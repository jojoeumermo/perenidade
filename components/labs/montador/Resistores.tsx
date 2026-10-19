// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";

const CORES = [
  { nome: "preto", hex: "#1a1a1a" },
  { nome: "marrom", hex: "#7a4a1e" },
  { nome: "vermelho", hex: "#c62828" },
  { nome: "laranja", hex: "#ef7d00" },
  { nome: "amarelo", hex: "#f5d000" },
  { nome: "verde", hex: "#2e7d32" },
  { nome: "azul", hex: "#1e56c8" },
  { nome: "violeta", hex: "#7b3fa0" },
  { nome: "cinza", hex: "#8a8a8a" },
  { nome: "branco", hex: "#f4f4f4" },
];
const TOLERANCIAS = [
  { nome: "dourado", hex: "#c9a227", valor: "±5%" },
  { nome: "prateado", hex: "#b8b8b8", valor: "±10%" },
  { nome: "marrom", hex: "#7a4a1e", valor: "±1%" },
];

export function formatarOhms(v: number) {
  if (v >= 1e6) return `${+(v / 1e6).toFixed(2)} MΩ`;
  if (v >= 1e3) return `${+(v / 1e3).toFixed(2)} kΩ`;
  return `${+v.toFixed(2)} Ω`;
}

/** Os valores comerciais da série E12 (os que se encontram em qualquer loja de eletrônica). */
const E12 = [10, 12, 15, 18, 22, 27, 33, 39, 47, 56, 68, 82];
export function comercialAcima(v: number) {
  for (let dec = 1; dec <= 1e7; dec *= 10) for (const b of E12) if (b * dec / 10 >= v) return (b * dec) / 10;
  return v;
}

function Resistor({ faixas, tol }: { faixas: number[]; tol: number }) {
  return (
    <svg viewBox="0 0 320 80" className="h-20 w-full max-w-sm" role="img" aria-label={`Resistor: ${faixas.map((f) => CORES[f].nome).join(", ")}, ${TOLERANCIAS[tol].nome}`}>
      <line x1="0" y1="40" x2="320" y2="40" stroke="#888" strokeWidth="4" />
      <rect x="70" y="18" width="180" height="44" rx="20" fill="#d9c08f" stroke="#8a7550" strokeWidth="2" />
      {faixas.map((f, i) => <rect key={i} x={95 + i * 28} y="18" width="14" height="44" fill={CORES[f].hex} />)}
      <rect x="215" y="18" width="14" height="44" fill={TOLERANCIAS[tol].hex} />
    </svg>
  );
}

/** Código de cores de resistor (quatro faixas), um desafio aleatório e a Lei de Ohm para o resistor do LED. */
export function Resistores() {
  const [faixas, setFaixas] = useState([1, 0, 2]);
  const [tol, setTol] = useState(0);
  const valor = (faixas[0] * 10 + faixas[1]) * 10 ** faixas[2];
  const [desafio, setDesafio] = useState<number[] | null>(null);
  const [resposta, setResposta] = useState("");
  const [conferido, setConferido] = useState<boolean | null>(null);
  const valorDesafio = desafio ? (desafio[0] * 10 + desafio[1]) * 10 ** desafio[2] : 0;
  const novo = () => { setDesafio([1 + Math.floor(Math.random() * 9), Math.floor(Math.random() * 10), Math.floor(Math.random() * 6)]); setResposta(""); setConferido(null); };
  const lerResposta = (t: string) => { const m = t.trim().toLowerCase().replace(",", ".").match(/^([\d.]+)\s*(k|m)?/); return m ? parseFloat(m[1]) * (m[2] === "k" ? 1e3 : m[2] === "m" ? 1e6 : 1) : NaN; };

  const [vf, setVf] = useState(5);
  const [vled, setVled] = useState(2);
  const [ma, setMa] = useState(20);
  const r = (vf - vled) / (ma / 1000);
  const potencia = (vf - vled) * (ma / 1000);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section>
        <h3 className="font-serif text-xl font-semibold">Código de cores</h3>
        <Resistor faixas={faixas} tol={tol} />
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {["1.º dígito", "2.º dígito", "Multiplicador"].map((nome, i) => (
            <label key={nome} className="text-xs">{nome}
              <select value={faixas[i]} onChange={(e) => setFaixas((f) => f.map((x, j) => (j === i ? Number(e.target.value) : x)))} className="mt-0.5 w-full border-2 border-ink bg-parchment px-1 py-1">
                {CORES.map((c, n) => (i === 0 && n === 0 ? null : <option key={c.nome} value={n}>{c.nome} ({i === 2 ? `×${(10 ** n).toLocaleString("pt-BR")}` : n})</option>))}
              </select>
            </label>
          ))}
          <label className="text-xs">Tolerância
            <select value={tol} onChange={(e) => setTol(Number(e.target.value))} className="mt-0.5 w-full border-2 border-ink bg-parchment px-1 py-1">
              {TOLERANCIAS.map((t, n) => <option key={t.nome} value={n}>{t.nome} ({t.valor})</option>)}
            </select>
          </label>
        </div>
        <p className="mt-2 text-lg">= <strong>{formatarOhms(valor)}</strong> {TOLERANCIAS[tol].valor}</p>
        <p className="text-xs text-ink-soft">Macete: “<strong>P</strong>reto <strong>M</strong>arrom <strong>V</strong>ermelho <strong>L</strong>aranja <strong>A</strong>marelo <strong>V</strong>erde <strong>A</strong>zul <strong>V</strong>ioleta <strong>C</strong>inza <strong>B</strong>ranco” vai de 0 a 9. A faixa dourada ou prateada fica do lado direito.</p>

        <div className="mt-4 border-2 border-ink bg-parchment-deep p-3">
          <p className="font-semibold">Desafio: quanto vale este resistor?</p>
          {desafio ? (
            <>
              <Resistor faixas={desafio} tol={0} />
              <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); setConferido(Math.abs(lerResposta(resposta) - valorDesafio) < 0.01 * valorDesafio); }}>
                <input value={resposta} onChange={(e) => setResposta(e.target.value)} placeholder="ex.: 4,7k ou 220" aria-label="Valor do resistor" className="border-2 border-ink bg-parchment px-2 py-1" />
                <button type="submit" className="cursor-pointer border-2 border-ink px-3 py-1 font-semibold hover:border-oxblood">Conferir</button>
                <button type="button" onClick={novo} className="cursor-pointer px-2 py-1 underline">Outro</button>
              </form>
              {conferido !== null && <p className={`mt-2 ${conferido ? "text-ok" : "text-oxblood"}`}>{conferido ? "Certo!" : `Não: é ${formatarOhms(valorDesafio)} (${CORES[desafio[0]].nome} ${desafio[0]}, ${CORES[desafio[1]].nome} ${desafio[1]}, ${CORES[desafio[2]].nome} ×${(10 ** desafio[2]).toLocaleString("pt-BR")}).`}</p>}
            </>
          ) : (
            <button type="button" onClick={novo} className="mt-2 cursor-pointer border-2 border-ink px-3 py-1 font-semibold hover:border-oxblood">Começar</button>
          )}
        </div>
      </section>
      <section>
        <h3 className="font-serif text-xl font-semibold">Lei de Ohm: o resistor do LED</h3>
        <p className="text-sm text-ink-soft">V = R × I. O resistor segura a sobra de tensão: R = (V da fonte − V do LED) ÷ corrente.</p>
        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
          <label>Fonte (V)<input type="number" step="0.1" min="0" value={vf} onChange={(e) => setVf(Number(e.target.value))} className="mt-0.5 w-full border-2 border-ink bg-parchment px-1 py-1" /></label>
          <label>LED (V)
            <select value={vled} onChange={(e) => setVled(Number(e.target.value))} className="mt-0.5 w-full border-2 border-ink bg-parchment px-1 py-1">
              <option value={2}>vermelho (2,0)</option><option value={2.1}>amarelo (2,1)</option><option value={2.2}>verde (2,2)</option><option value={3.2}>azul ou branco (3,2)</option>
            </select>
          </label>
          <label>Corrente (mA)<input type="number" min="1" max="50" value={ma} onChange={(e) => setMa(Number(e.target.value))} className="mt-0.5 w-full border-2 border-ink bg-parchment px-1 py-1" /></label>
        </div>
        {vf <= vled ? (
          <p className="mt-3 text-oxblood">A fonte precisa ter mais tensão que o LED: com {vf} V, o LED de {vled} V nem acende.</p>
        ) : (
          <div className="mt-3 border-l-4 border-ok p-2 text-sm">
            <p>R = ({vf} − {vled}) ÷ {ma / 1000} = <strong>{formatarOhms(r)}</strong></p>
            <p>Valor comercial logo acima (série E12): <strong>{formatarOhms(comercialAcima(r))}</strong> (arredonde sempre para cima: um pouco menos de corrente, o LED dura mais).</p>
            <p>Potência no resistor: {(potencia * 1000).toFixed(0)} mW {potencia > 0.25 ? "— passa de 1/4 W: use resistor de 1/2 W ou mais." : "— um resistor comum de 1/4 W aguenta."}</p>
          </div>
        )}
      </section>
    </div>
  );
}
