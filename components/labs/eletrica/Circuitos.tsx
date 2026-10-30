// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { type Lampada, resolver } from "./conta-dos-circuitos";

const fmt = (n: number, c = 2) => (Number.isFinite(n) ? n.toFixed(c).replace(".", ",") : "—");

const MISSOES = [
  { texto: "Em série, queime a lâmpada 2. O que acontece com as outras?", confere: (t: string, ls: Lampada[]) => t === "serie" && ls[1].queimada, explica: "Em série só há um caminho: uma lâmpada queimada abre o circuito e todas apagam. É por isso que as luzes de uma casa não são ligadas em série." },
  { texto: "Em paralelo, desligue a chave da lâmpada 1. As outras continuam acesas?", confere: (t: string, ls: Lampada[]) => t === "paralelo" && !ls[0].chave && ls[1].chave, explica: "Em paralelo cada lâmpada tem o próprio caminho até a fonte: apagar uma não mexe nas outras. É assim que a casa é ligada." },
  { texto: "Em paralelo, deixe a lâmpada 1 com o dobro da potência da lâmpada 2.", confere: (t: string, ls: Lampada[], v: number) => t === "paralelo" && Math.abs(v * v / ls[0].ohm - 2 * (v * v / ls[1].ohm)) < 0.05 * (v * v / ls[0].ohm), explica: "Com a mesma tensão, a potência é V² ÷ R: metade da resistência dá o dobro da potência (e do brilho)." },
  { texto: "Em série, faça a tensão na lâmpada 1 ser metade da tensão da bateria.", confere: (t: string, ls: Lampada[]) => t === "serie" && !ls.some((l) => l.queimada || !l.chave) && Math.abs(ls[0].ohm - (ls[1].ohm + ls[2].ohm)) < 0.6, explica: "Em série a tensão se divide na proporção das resistências: R1 igual à soma das outras leva metade da tensão." },
];

/**
 * Circuitos de lâmpadas: a mesma bateria e três lâmpadas, em série ou em paralelo. Mude a tensão, a resistência de cada
 * lâmpada, as chaves e queime lâmpadas: o brilho, a corrente, a tensão e a potência de cada uma mudam na hora.
 */
export function Circuitos() {
  const [tipo, setTipo] = useState<"serie" | "paralelo">("serie");
  const [volts, setVolts] = useState(12);
  const [geral, setGeral] = useState(true);
  const [ls, setLs] = useState<Lampada[]>([{ ohm: 12, chave: true, queimada: false }, { ohm: 12, chave: true, queimada: false }, { ohm: 12, chave: true, queimada: false }]);
  const r = resolver(tipo, volts, ls, geral);
  const potenciaMax = Math.max(1, ...r.cada.map((c) => c.p));
  const mudar = (i: number, x: Partial<Lampada>) => setLs((a) => a.map((l, j) => (j === i ? { ...l, ...x } : l)));
  // Desenho: a bateria à esquerda, as lâmpadas em fila (série) ou em degraus (paralelo).
  const brilho = (p: number) => Math.min(1, p / Math.max(potenciaMax, 3));
  return (
    <div className="font-sans text-sm">
      <div className="flex flex-wrap items-center gap-2">
        {(["serie", "paralelo"] as const).map((t) => <button key={t} type="button" aria-pressed={tipo === t} onClick={() => setTipo(t)} className={`cursor-pointer border-2 px-3 py-1.5 font-bold ${tipo === t ? "border-ink bg-ink text-parchment" : "border-ink/30 hover:border-ink"}`}>{t === "serie" ? "Em série" : "Em paralelo"}</button>)}
        <label className="ml-2 flex items-center gap-2">Bateria <input type="range" min={1.5} max={24} step={0.5} value={volts} onChange={(e) => setVolts(Number(e.target.value))} /> <strong className="w-14 font-mono">{fmt(volts, 1)} V</strong></label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={geral} onChange={(e) => setGeral(e.target.checked)} />Chave geral ligada</label>
      </div>

      <svg viewBox="0 0 640 260" className="mt-4 w-full border-2 border-ink bg-[#f9f3e3]" role="img" aria-label={`Circuito ${tipo === "serie" ? "em série" : "em paralelo"} com três lâmpadas`}>
        {/* Bateria */}
        <g>
          <line x1="40" y1="110" x2="40" y2="150" stroke="#17130e" strokeWidth="3" />
          <line x1="28" y1="122" x2="52" y2="122" stroke="#17130e" strokeWidth="4" />
          <line x1="34" y1="136" x2="46" y2="136" stroke="#17130e" strokeWidth="4" />
          <text x="10" y="180" fontSize="13" fontFamily="ui-monospace, monospace">{fmt(volts, 1)} V</text>
        </g>
        <polyline points="40,110 40,40 600,40" fill="none" stroke={geral ? "#17130e" : "#999"} strokeWidth="3" />
        <polyline points="40,150 40,220 600,220" fill="none" stroke="#17130e" strokeWidth="3" />
        {tipo === "serie" ? (
          <>
            {ls.map((l, i) => {
              const x = 170 + i * 150;
              return <Bulbo key={i} x={x} y={40} n={i + 1} brilho={brilho(r.cada[i].p)} queimada={l.queimada} aberta={!l.chave} />;
            })}
            <line x1="600" y1="40" x2="600" y2="220" stroke="#17130e" strokeWidth="3" />
          </>
        ) : (
          ls.map((l, i) => {
            const x = 210 + i * 150;
            return (
              <g key={i}>
                <line x1={x} y1="40" x2={x} y2="105" stroke="#17130e" strokeWidth="3" />
                <line x1={x} y1="155" x2={x} y2="220" stroke="#17130e" strokeWidth="3" />
                <Bulbo x={x} y={130} n={i + 1} brilho={brilho(r.cada[i].p)} queimada={l.queimada} aberta={!l.chave} vertical />
              </g>
            );
          })
        )}
        {!geral && <text x="300" y="30" fontSize="13" fill="#c21f16">chave geral aberta</text>}
      </svg>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        {ls.map((l, i) => (
          <div key={i} className="border-2 border-ink/20 bg-parchment-deep p-3">
            <p className="font-bold">Lâmpada {i + 1}</p>
            <label className="mt-1 block">Resistência: <strong className="font-mono">{l.ohm} Ω</strong><input type="range" min={2} max={60} value={l.ohm} onChange={(e) => mudar(i, { ohm: Number(e.target.value) })} className="w-full" /></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={l.chave} onChange={(e) => mudar(i, { chave: e.target.checked })} />chave dela ligada</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={l.queimada} onChange={(e) => mudar(i, { queimada: e.target.checked })} />queimada</label>
            <dl className="mt-2 grid grid-cols-3 gap-1 font-mono text-xs">
              <div><dt className="text-ink-soft">corrente</dt><dd>{fmt(r.cada[i].i)} A</dd></div>
              <div><dt className="text-ink-soft">tensão</dt><dd>{fmt(r.cada[i].v)} V</dd></div>
              <div><dt className="text-ink-soft">potência</dt><dd>{fmt(r.cada[i].p, 1)} W</dd></div>
            </dl>
          </div>
        ))}
      </div>
      <p className="mt-3 border-l-4 border-gold bg-parchment-deep p-2">
        Corrente total que sai da bateria: <strong className="font-mono">{fmt(r.total)} A</strong>.{" "}
        {tipo === "serie" ? "Em série a corrente é a mesma em todas as lâmpadas e a tensão da bateria se divide entre elas." : "Em paralelo todas recebem a tensão inteira da bateria e as correntes se somam."}
      </p>
      <div className="mt-4 border-2 border-ink bg-parchment-deep p-3">
        <p className="font-mono text-[0.65rem] uppercase tracking-widest text-oxblood">Desafios</p>
        <ol className="mt-1 list-decimal space-y-1 pl-5">
          {MISSOES.map((m) => {
            const ok = m.confere(tipo, ls, volts);
            return <li key={m.texto} className={ok ? "text-ok" : ""}>{m.texto}{ok && <span className="block text-ink">✓ {m.explica}</span>}</li>;
          })}
        </ol>
      </div>
    </div>
  );
}

function Bulbo({ x, y, n, brilho, queimada, aberta, vertical = false }: { x: number; y: number; n: number; brilho: number; queimada: boolean; aberta: boolean; vertical?: boolean }) {
  const cor = queimada ? "#555" : `rgba(255, ${190 + 50 * brilho}, ${40 + 60 * (1 - brilho)}, ${0.15 + 0.85 * brilho})`;
  return (
    <g>
      {!vertical && <line x1={x - 60} y1={y} x2={x + 60} y2={y} stroke="#f9f3e3" strokeWidth="5" />}
      {!vertical && <line x1={x - 60} y1={y} x2={x - 26} y2={y} stroke="#17130e" strokeWidth="3" />}
      {!vertical && <line x1={x + 26} y1={y} x2={x + 60} y2={y} stroke={aberta ? "#999" : "#17130e"} strokeWidth="3" strokeDasharray={aberta ? "4 4" : undefined} />}
      {brilho > 0.05 && !queimada && <circle cx={x} cy={y} r={22 + 18 * brilho} fill="#ffd54a" opacity={0.25 * brilho} />}
      <circle cx={x} cy={y} r="20" fill={cor} stroke="#17130e" strokeWidth="2.5" />
      <path d={`M${x - 8} ${y + 4} q4 -12 8 0 q4 12 8 0`} fill="none" stroke={queimada ? "#222" : "#7a4a24"} strokeWidth="2" strokeDasharray={queimada ? "3 3" : undefined} />
      <text x={x} y={y + (vertical ? 40 : 42)} textAnchor="middle" fontSize="12" fontFamily="ui-monospace, monospace">L{n}{aberta ? " (chave aberta)" : queimada ? " (queimada)" : ""}</text>
    </g>
  );
}
