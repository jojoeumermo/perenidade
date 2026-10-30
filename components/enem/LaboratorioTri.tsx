// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { fill } from "@/i18n/config";
import { estimarTheta, ITENS_ILUSTRATIVOS, probabilidade } from "@/lib/enem-tri";
import type { TextosDoEstudo } from "@/lib/textos-estudo";

type S = TextosDoEstudo["enem"]["tri"];
const claro = "cursor-pointer border-2 border-ink px-3 py-1.5 font-semibold hover:border-oxblood hover:text-oxblood";
const num = (x: number, casas = 2) => x.toFixed(casas).replace(".", ",");

/**
 * O laboratório da TRI: dez itens ilustrativos, do mais fácil ao mais difícil. A pessoa marca quais acertou (ou usa os
 * exemplos prontos) e vê a proficiência estimada pelo modelo de 3 parâmetros. Mostra que o mesmo número de acertos pode
 * dar estimativas diferentes, conforme a coerência. Aviso fixo: não é a nota oficial.
 */
export function LaboratorioTri({ s }: { s: S }) {
  const [acertos, setAcertos] = useState<boolean[]>(ITENS_ILUSTRATIVOS.map((_, i) => i < 5));
  const theta = estimarTheta(ITENS_ILUSTRATIVOS, acertos);
  const total = acertos.filter(Boolean).length;
  const usar = (f: (i: number) => boolean) => setAcertos(ITENS_ILUSTRATIVOS.map((_, i) => f(i)));
  return (
    <div className="mt-8 font-sans text-sm">
      <p className="border-2 border-oxblood bg-parchment p-4 font-semibold">{s.aviso}</p>
      <section className="mt-6 border-2 border-ink bg-parchment-deep p-5">
        <h2 className="font-serif text-2xl font-semibold">{s.preveja}</h2>
        <p className="mt-1">{s.prevejaTexto}</p>
        <p className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={claro} onClick={() => usar((i) => i < 5)}>{s.coerente}</button>
          <button type="button" className={claro} onClick={() => usar((i) => i >= 5)}>{s.incoerente}</button>
          <button type="button" className={claro} onClick={() => usar((i) => i % 2 === 0)}>{s.alternado}</button>
        </p>
      </section>
      <section className="mt-6 border-2 border-ink bg-parchment-deep p-5">
        <h2 className="font-serif text-2xl font-semibold">{s.rode}</h2>
        <fieldset className="mt-3">
          <legend className="font-semibold">{s.marque}</legend>
          <table className="mt-2 w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-rule">
                <th className="py-1 pr-2">{s.item}</th>
                <th className="py-1 pr-2">{s.dificuldade}</th>
                <th className="py-1 pr-2">{s.acertou}</th>
                <th className="py-1">{fill(s.chance, { t: num(theta) })}</th>
              </tr>
            </thead>
            <tbody>
              {ITENS_ILUSTRATIVOS.map((it, i) => (
                <tr key={i} className="border-b border-rule">
                  <td className="py-1 pr-2 font-mono">{i + 1}</td>
                  <td className="py-1 pr-2 font-mono">{num(it.b, 1)}</td>
                  <td className="py-1 pr-2">
                    <input type="checkbox" aria-label={fill(s.acertouItem, { n: i + 1 })} checked={acertos[i]} onChange={(e) => setAcertos(acertos.map((x, k) => (k === i ? e.target.checked : x)))} />
                  </td>
                  <td className="py-1 font-mono">{Math.round(probabilidade(it, theta) * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </fieldset>
        <p className="mt-4 font-serif text-2xl" role="status" aria-live="polite">
          {fill(s.resultado, { n: total, t: num(theta) })}
        </p>
      </section>
      <section className="mt-6 border-2 border-ink bg-parchment-deep p-5">
        <h2 className="font-serif text-2xl font-semibold">{s.compare}</h2>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          {s.explicacoes.map((e) => <li key={e}>{e}</li>)}
        </ul>
        <p className="mt-3 font-mono text-xs">{s.formula}</p>
      </section>
    </div>
  );
}
