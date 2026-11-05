// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { Fontes, Moldura } from "./Base";
import { DISPONIBILIDADES_POR_SERVIDOR, FONTES_REDUNDANCIA, NOTA_DO_MODELO, TABELA_SRE, disponibilidade, escreverTempo, minutosForaPorAno } from "./dados/redundancia";

const pct = (d: number) => (d * 100).toFixed(4).replace(".", ",").replace(/0+$/, "").replace(/,$/, "") + "%";

/** Quantos servidores, quão bons, e o que acontece quando um cai. Sem placar: só números para comparar. */
export default function RedundanciaDeServidores() {
  const [n, setN] = useState(2);
  const [a, setA] = useState<number>(0.99);
  const [separados, setSeparados] = useState(false);
  const [caidos, setCaidos] = useState<boolean[]>(Array(5).fill(false));
  const comum = separados ? 0.9999 : 0.999;
  const disp = disponibilidade(a, n, comum);
  const vivos = caidos.slice(0, n).filter((c) => !c).length;
  const noAr = vivos > 0;
  const sozinho = disponibilidade(a, 1, comum);

  return (
    <Moldura titulo="Redundância de servidores" intro="Um serviço guardado em um servidor sai do ar quando ele falha. Com vários, basta um estar de pé. Mude os números, derrube servidores e veja o tempo fora do ar por ano.">
      <div className="flex flex-wrap items-end gap-4 font-sans text-sm">
        <label className="grid gap-1">
          Quantos servidores: {n}
          <input type="range" min={1} max={5} value={n} onChange={(e) => setN(Number(e.target.value))} className="w-40" />
        </label>
        <label className="grid gap-1">
          Disponibilidade de cada um
          <select value={a} onChange={(e) => setA(Number(e.target.value))} className="border-2 border-ink bg-transparent p-1">
            {DISPONIBILIDADES_POR_SERVIDOR.map((d) => (<option key={d} value={d}>{pct(d)}</option>))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={separados} onChange={(e) => setSeparados(e.target.checked)} className="h-5 w-5" />
          Em lugares separados (energia e rede diferentes)
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Servidores: clique para derrubar ou levantar">
        {Array.from({ length: n }, (_, i) => (
          <button key={i} type="button" onClick={() => setCaidos((c) => c.map((x, j) => (j === i ? !x : x)))} aria-pressed={caidos[i]} className={`guia-opcao ${caidos[i] ? "line-through opacity-60" : ""}`}>
            Servidor {i + 1}: {caidos[i] ? "caído" : "de pé"}
          </button>
        ))}
      </div>
      <p role="status" aria-live="polite" className="mt-3 border-l-4 border-prelo-texto pl-3 leading-relaxed">
        <strong>{noAr ? "O serviço está no ar." : "O serviço saiu do ar."}</strong> {vivos} de {n} servidores de pé.
      </p>

      <div className="mt-4 border-2 border-ink bg-folha p-3">
        <p className="font-sans text-xs font-bold uppercase tracking-[0.1em]">A conta</p>
        <p className="mt-1 leading-relaxed">
          Disponibilidade do serviço: <strong>{pct(disp)}</strong>. Fora do ar por ano: <strong>{escreverTempo(minutosForaPorAno(disp))}</strong>.
        </p>
        <p className="mt-1 text-sm text-ink-soft">
          Com um servidor só, na mesma situação, seria {pct(sozinho)} ({escreverTempo(minutosForaPorAno(sozinho))} fora por ano). Fórmula: A = comum × (1 − (1 − a)^n), com a peça comum a {pct(comum)}. Note que a peça comum limita o ganho: depois de certo ponto, mais servidores quase não ajudam.
        </p>
      </div>

      <details className="mt-4">
        <summary className="cursor-pointer font-sans text-sm font-bold">Tabela de referência: quanto tempo fora do ar cada nível permite</summary>
        <table className="mt-2 w-full border-collapse text-left text-sm">
          <caption className="sr-only">Disponibilidade e tempo fora do ar por ano</caption>
          <thead><tr><th className="border border-ink p-1">Disponibilidade</th><th className="border border-ink p-1">Fora do ar por ano</th></tr></thead>
          <tbody>
            {TABELA_SRE.map((l) => (<tr key={l.texto}><td className="border border-ink p-1">{l.texto}</td><td className="border border-ink p-1">{escreverTempo(l.minutosPorAno)}</td></tr>))}
          </tbody>
        </table>
      </details>
      <Fontes fontes={FONTES_REDUNDANCIA} nota={NOTA_DO_MODELO} />
    </Moldura>
  );
}
