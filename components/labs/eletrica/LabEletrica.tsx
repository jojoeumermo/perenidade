// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { Circuitos } from "./Circuitos";
import { Instalacao } from "./Instalacao";
import { BANCADA_ELETRICA } from "./multimetro";
import { type Missao, MultimetroVisual } from "./MultimetroVisual";

const MISSOES: Missao[] = [
  { texto: "Confira se a tomada tem tensão (sem queimar o multímetro).", peca: "tomada127", chaves: ["vac750"] },
  { texto: "Descubra se a pilha AA está boa.", peca: "pilha", chaves: ["vdc20"] },
  { texto: "Descubra qual lâmpada queimou, com o teste de continuidade.", peca: "lampada-queimada", chaves: ["cont", "ohm200", "ohm2k"] },
  { texto: "Meça a resistência do chuveiro na escala certa.", peca: "chuveiro", chaves: ["ohm200"] },
  { texto: "Leia o resistor de 100 kΩ sem estourar a escala.", peca: "resistor100k", chaves: ["ohm200k"] },
  { texto: "Teste se o fio está inteiro.", peca: "fio", chaves: ["cont"] },
];

function Calculadoras() {
  const [v, setV] = useState("127");
  const [r, setR] = useState("10");
  const [w, setW] = useState("5500");
  const [h, setH] = useState("0.5");
  const [d, setD] = useState("30");
  const [tarifa, setTarifa] = useState("0.85");
  const n = (x: string) => Number(x.replace(",", "."));
  const i = n(v) / n(r);
  const p = n(v) * i;
  const kwh = (n(w) * n(h) * n(d)) / 1000;
  const fmt = (x: number, c = 2) => (Number.isFinite(x) ? x.toLocaleString("pt-BR", { maximumFractionDigits: c }) : "—");
  const campo = "mt-1 w-full border-2 border-ink/30 bg-parchment px-2 py-1.5";
  return (
    <div className="grid gap-5 font-sans text-sm md:grid-cols-2">
      <section className="border-2 border-ink bg-parchment-deep p-4">
        <h3 className="font-serif text-xl font-semibold">Lei de Ohm e potência</h3>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label>Tensão (V)<input inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} className={campo} /></label>
          <label>Resistência (Ω)<input inputMode="decimal" value={r} onChange={(e) => setR(e.target.value)} className={campo} /></label>
        </div>
        <p className="mt-3">Corrente: <strong className="font-mono">I = V ÷ R = {fmt(i)} A</strong></p>
        <p>Potência: <strong className="font-mono">P = V × I = {fmt(p, 0)} W</strong></p>
        <p className="mt-2 text-xs text-ink-soft">Exemplo: uma resistência de 10 Ω em 127 V puxa 12,7 A e dá uns 1.613 W.</p>
      </section>
      <section className="border-2 border-ink bg-parchment-deep p-4">
        <h3 className="font-serif text-xl font-semibold">Quanto um aparelho gasta</h3>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label>Potência (W)<input inputMode="decimal" value={w} onChange={(e) => setW(e.target.value)} className={campo} /></label>
          <label>Horas por dia<input inputMode="decimal" value={h} onChange={(e) => setH(e.target.value)} className={campo} /></label>
          <label>Dias no mês<input inputMode="decimal" value={d} onChange={(e) => setD(e.target.value)} className={campo} /></label>
          <label>Tarifa (R$ por kWh, veja na sua conta)<input inputMode="decimal" value={tarifa} onChange={(e) => setTarifa(e.target.value)} className={campo} /></label>
        </div>
        <p className="mt-3">Consumo: <strong className="font-mono">{fmt(kwh, 1)} kWh por mês</strong> (potência × horas × dias ÷ 1.000)</p>
        <p>Custo aproximado: <strong className="font-mono">R$ {fmt(kwh * n(tarifa))}</strong></p>
        <p className="mt-2 text-xs text-ink-soft">A tarifa muda por distribuidora, bandeira e impostos: use o valor do kWh escrito na sua conta de luz. O exemplo é um chuveiro de 5.500 W usado meia hora por dia.</p>
      </section>
    </div>
  );
}

const ABAS = [
  { id: "multimetro", nome: "🔎 Multímetro na bancada" },
  { id: "circuitos", nome: "💡 Série e paralelo" },
  { id: "instalacao", nome: "🏠 Ligar luz e tomada" },
  { id: "contas", nome: "🧮 Contas do eletricista" },
] as const;

/**
 * O laboratório de elétrica: medir com o multímetro como na bancada, ver na prática a diferença entre série e paralelo,
 * ligar um ponto de luz e uma tomada com as cores certas, e as contas do dia a dia. Tudo no aparelho, sem risco: na vida
 * real, desligue o disjuntor e chame um eletricista habilitado para instalação nova.
 */
export function LabEletrica() {
  const [aba, setAba] = useState<(typeof ABAS)[number]["id"]>("multimetro");
  return (
    <div className="mt-8">
      <div role="tablist" aria-label="Bancadas do laboratório" className="flex flex-wrap gap-2 font-sans text-sm">
        {ABAS.map((a) => (
          <button key={a.id} type="button" role="tab" aria-selected={aba === a.id} onClick={() => setAba(a.id)} className={`cursor-pointer border-2 px-3 py-2 font-bold ${aba === a.id ? "border-ink bg-ink text-parchment" : "border-ink/25 bg-parchment-deep hover:border-ink"}`}>{a.nome}</button>
        ))}
      </div>
      <p className="mt-3 border-l-4 border-[#c21f16] bg-parchment-deep px-3 py-2 font-sans text-sm">Simulação para aprender. Na vida real: desligue o disjuntor antes de mexer, confirme que não há tensão e use as ferramentas e os equipamentos de proteção. Instalação nova ou reforma é trabalho de eletricista habilitado.</p>
      <div className="mt-6">
        {aba === "multimetro" && <MultimetroVisual pecas={BANCADA_ELETRICA} missoes={MISSOES} titulo="Bancada de elétrica" />}
        {aba === "circuitos" && <Circuitos />}
        {aba === "instalacao" && <Instalacao />}
        {aba === "contas" && <Calculadoras />}
      </div>
    </div>
  );
}
