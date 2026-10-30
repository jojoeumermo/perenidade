// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { avaliar, CORES, type Cor, type Fio, grupos, type Resultado, type Terminal, TERMINAIS } from "./regras-da-instalacao";

// O treino de instalação: um ponto de luz com interruptor simples e uma tomada de três pinos, ligados ao quadro. A
// pessoa escolhe de onde a onde vai cada fio e de que cor; ao ligar o disjuntor, o simulador diz o que aconteceria.
// As cores seguem a norma brasileira de instalações (NBR 5410): neutro azul-claro, terra verde-amarelo (ou verde); fase
// de qualquer outra cor. O "retorno" (do interruptor à lâmpada) não tem cor obrigatória: é costume usar uma cor própria.

/** O treino: lista de fios, o desenho do circuito e o botão de ligar o disjuntor. */
export function Instalacao() {
  const [fios, setFios] = useState<Fio[]>([]);
  const [novo, setNovo] = useState<Fio>({ de: "Q.F", para: "I.1", cor: "preto" });
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [interruptor, setInterruptor] = useState(true);
  const acesa = resultado && resultado.tipo !== "perigo" || resultado?.titulo.startsWith("Funciona") ? (() => {
    const achar = grupos(fios, interruptor);
    return (achar("L.C") === achar("Q.F") && achar("L.R") === achar("Q.N")) || (achar("L.R") === achar("Q.F") && achar("L.C") === achar("Q.N"));
  })() : false;
  const campo = "border-2 border-ink/30 bg-parchment px-2 py-1.5";
  const corDe = (c: Cor) => CORES.find(([n]) => n === c)?.[1] ?? "#000";
  return (
    <div className="grid grid-cols-1 gap-5 font-sans text-sm lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div>
        <p className="text-ink-soft">Ligue o ponto de luz (com interruptor simples) e a tomada ao quadro. Escolha cada fio: de onde, para onde e a cor. Depois ligue o disjuntor.</p>
        <div className="mt-3 grid gap-2 border-2 border-ink/20 bg-parchment-deep p-3">
          <label className="block">De<select value={novo.de} onChange={(e) => setNovo({ ...novo, de: e.target.value as Terminal })} className={`${campo} mt-1 w-full`}>{(Object.keys(TERMINAIS) as Terminal[]).map((t) => <option key={t} value={t}>{TERMINAIS[t]}</option>)}</select></label>
          <label className="block">Para<select value={novo.para} onChange={(e) => setNovo({ ...novo, para: e.target.value as Terminal })} className={`${campo} mt-1 w-full`}>{(Object.keys(TERMINAIS) as Terminal[]).map((t) => <option key={t} value={t}>{TERMINAIS[t]}</option>)}</select></label>
          <div className="flex flex-wrap items-center gap-1">
            <span>Cor:</span>
            {CORES.map(([nome, hex]) => (
              <button key={nome} type="button" aria-pressed={novo.cor === nome} title={nome} aria-label={`Fio ${nome}`} onClick={() => setNovo({ ...novo, cor: nome })} className={`h-7 w-7 cursor-pointer border-2 ${novo.cor === nome ? "border-ink ring-2 ring-[#c21f16]" : "border-ink/30"}`} style={{ background: nome === "verde-amarelo" ? "repeating-linear-gradient(45deg,#3c9a3c 0 6px,#e8d020 6px 12px)" : hex }} />
            ))}
            <span className="ml-1 text-xs text-ink-soft">{novo.cor}</span>
          </div>
          <button type="button" disabled={novo.de === novo.para} onClick={() => { setFios((f) => [...f, novo]); setResultado(null); }} className="cursor-pointer border-2 border-ink px-3 py-1.5 font-bold hover:border-oxblood disabled:opacity-40">+ Passar este fio</button>
        </div>
        <ol className="mt-3 space-y-1">
          {fios.map((f, i) => (
            <li key={i} className="flex items-center gap-2 border-b border-rule py-1">
              <span aria-hidden className="inline-block h-3 w-8" style={{ background: f.cor === "verde-amarelo" ? "repeating-linear-gradient(45deg,#3c9a3c 0 6px,#e8d020 6px 12px)" : corDe(f.cor) }} />
              <span className="flex-1">{TERMINAIS[f.de]} → {TERMINAIS[f.para]}</span>
              <button type="button" aria-label="Tirar este fio" onClick={() => { setFios((x) => x.filter((_, j) => j !== i)); setResultado(null); }} className="cursor-pointer px-1 text-lg text-ink-soft hover:text-oxblood">✕</button>
            </li>
          ))}
          {fios.length === 0 && <li className="text-ink-soft">Nenhum fio passado ainda.</li>}
        </ol>
        <p className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => setResultado(avaliar(fios))} className="cursor-pointer bg-[#c21f16] px-5 py-2 font-bold text-white hover:bg-[#a51810]">Ligar o disjuntor</button>
          <button type="button" onClick={() => { setFios([]); setResultado(null); }} className="cursor-pointer border-2 border-ink px-3 py-1.5">Começar de novo</button>
        </p>
      </div>
      <div>
        <svg viewBox="0 0 360 260" className="w-full border-2 border-ink bg-[#f9f3e3]" role="img" aria-label={`Lâmpada ${acesa ? "acesa" : "apagada"}`}>
          <rect x="14" y="20" width="80" height="120" fill="#ddd" stroke="#17130e" strokeWidth="2" />
          <text x="54" y="40" textAnchor="middle" fontSize="11" fontFamily="ui-monospace, monospace">QUADRO</text>
          <text x="54" y="70" textAnchor="middle" fontSize="11">F · N · T</text>
          <rect x="150" y="150" width="50" height="70" rx="4" fill="#fff" stroke="#17130e" strokeWidth="2" />
          <rect x="165" y={interruptor ? 165 : 185} width="20" height="20" fill="#bbb" stroke="#17130e" />
          <text x="175" y="238" textAnchor="middle" fontSize="11">interruptor</text>
          {acesa && <circle cx="270" cy="70" r="46" fill="#ffd54a" opacity="0.35" />}
          <circle cx="270" cy="70" r="26" fill={acesa ? "#ffe680" : "#eee"} stroke="#17130e" strokeWidth="2" />
          <text x="270" y="118" textAnchor="middle" fontSize="11">lâmpada</text>
          <rect x="250" y="160" width="60" height="70" rx="8" fill="#fff" stroke="#17130e" strokeWidth="2" />
          <circle cx="268" cy="188" r="5" fill="#17130e" /><circle cx="292" cy="188" r="5" fill="#17130e" /><circle cx="280" cy="210" r="5" fill="#17130e" />
          <text x="280" y="246" textAnchor="middle" fontSize="11">tomada</text>
        </svg>
        <label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={interruptor} onChange={(e) => setInterruptor(e.target.checked)} /> Interruptor ligado</label>
        {resultado && (
          <div role="status" className={`mt-3 border-l-4 p-3 ${resultado.tipo === "ok" ? "border-ok bg-parchment-deep" : resultado.tipo === "perigo" ? "border-[#c21f16] bg-[#c21f16]/10" : "border-gold bg-parchment-deep"}`}>
            <p className="font-bold">{resultado.titulo}</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">{resultado.itens.map((i) => <li key={i}>{i}</li>)}</ul>
          </div>
        )}
        <details className="mt-3 border border-rule p-2">
          <summary className="cursor-pointer font-semibold">Dica: o caminho certo</summary>
          <p className="mt-1">Fase do quadro → borne 1 do interruptor; borne 2 → contato central da lâmpada (o “retorno”); rosca da lâmpada → neutro. Na tomada: fase, neutro e terra, cada um do seu barramento. Neutro azul-claro, terra verde-amarelo.</p>
          <p className="mt-1 text-ink-soft">Na vida real: desligue o disjuntor, confirme com o multímetro (ou teste de tensão) que não há energia e só então mexa. Instalação nova ou reforma pede eletricista habilitado e projeto.</p>
        </details>
      </div>
    </div>
  );
}
