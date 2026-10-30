// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { Modulos } from "../kit";
import { Circuitos } from "./Circuitos";
import { Capacitor, Fonte, LedResistor, Logica, SensorDeLuz } from "./BancadaEletronica";
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
    <div className="grid grid-cols-1 gap-5 font-sans text-sm md:grid-cols-2">
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

type Id = "multimetro" | "circuitos" | "instalacao" | "contas" | "led" | "capacitor" | "logica" | "fonte" | "sensor";
const MODULOS: { id: Id; nome: string; icone: string; resumo: string }[] = [
  { id: "multimetro", nome: "Multímetro na bancada", icone: "multimetro", resumo: "Medir tensão, resistência e continuidade" },
  { id: "circuitos", nome: "Série e paralelo", icone: "lampada2", resumo: "Três lâmpadas e uma bateria" },
  { id: "instalacao", nome: "Ligar luz e tomada", icone: "casa", resumo: "Fase, neutro, retorno e terra" },
  { id: "contas", nome: "Contas do eletricista", icone: "calculadora", resumo: "Ohm, potência e conta de luz" },
  { id: "led", nome: "LED e resistor", icone: "led", resumo: "A primeira montagem na protoboard" },
  { id: "capacitor", nome: "Capacitor e o tempo", icone: "capacitor", resumo: "Carga e descarga no osciloscópio" },
  { id: "logica", nome: "Portas lógicas", icone: "porta", resumo: "E, OU, NÃO e o somador de 4 bits" },
  { id: "fonte", nome: "Fonte de alimentação", icone: "fonte", resumo: "Da tomada à tensão contínua" },
  { id: "sensor", nome: "Sensor de luz", icone: "sensor", resumo: "O poste que acende sozinho" },
];

/**
 * O laboratório de elétrica e eletrônica: medir com o multímetro como na bancada, série e paralelo, ligar um ponto de
 * luz e uma tomada com as cores certas, as contas do dia a dia e a bancada de eletrônica (LED, capacitor, portas
 * lógicas, fonte e sensor). Tudo no aparelho, sem risco: na vida real, desligue o disjuntor e chame um eletricista
 * habilitado para instalação nova.
 */
export function LabEletrica() {
  const [atual, setAtual] = useState<Id>("multimetro");
  return (
    <div className="mt-8 font-sans">
      <p className="border-l-4 border-[#c21f16] bg-parchment-deep px-3 py-2 text-sm">Simulação para aprender. Na vida real: desligue o disjuntor antes de mexer, confirme que não há tensão e use as ferramentas e os equipamentos de proteção. Instalação nova ou reforma é trabalho de eletricista habilitado.</p>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <div>
          <p className="mb-2 hidden text-[0.65rem] font-semibold uppercase tracking-widest text-ink-soft lg:block">Elétrica de casa · eletrônica</p>
          <Modulos itens={MODULOS} atual={atual} escolher={setAtual} />
        </div>
        <div className="min-w-0">
          {atual === "multimetro" && <MultimetroVisual pecas={BANCADA_ELETRICA} missoes={MISSOES} titulo="Bancada de elétrica" />}
          {atual === "circuitos" && <Circuitos />}
          {atual === "instalacao" && <Instalacao />}
          {atual === "contas" && <Calculadoras />}
          {atual === "led" && <LedResistor />}
          {atual === "capacitor" && <Capacitor />}
          {atual === "logica" && <Logica />}
          {atual === "fonte" && <Fonte />}
          {atual === "sensor" && <SensorDeLuz />}
        </div>
      </div>
    </div>
  );
}
