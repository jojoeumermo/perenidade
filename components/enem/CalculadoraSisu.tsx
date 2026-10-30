// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { fill } from "@/i18n/config";
import { mediaPonderada, PROVAS_DO_SISU, type ProvaDoSisu } from "@/lib/enem-sisu";
import type { TextosDoEstudo } from "@/lib/textos-estudo";

const campo = "mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2";

/** A média ponderada do Sisu com as notas e os pesos que a pessoa digita. Nada sai do aparelho; nenhuma nota de corte. */
export function CalculadoraSisu({ nomes, s }: { nomes: Record<ProvaDoSisu, string>; s: TextosDoEstudo["enem"]["sisu"] }) {
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [pesos, setPesos] = useState<Record<string, string>>({});
  const ler = (v: string | undefined) => (v === undefined || v.trim() === "" ? undefined : Number(v.replace(",", ".")));
  const media = mediaPonderada(Object.fromEntries(PROVAS_DO_SISU.map((p) => [p, ler(notas[p])])), Object.fromEntries(PROVAS_DO_SISU.map((p) => [p, ler(pesos[p] ?? "1")])));
  return (
    <div className="mt-8 border-2 border-ink bg-parchment-deep p-5 font-sans text-sm">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-rule">
            <th className="py-1 pr-2">{s.prova}</th>
            <th className="py-1 pr-2">{s.nota}</th>
            <th className="py-1">{s.peso}</th>
          </tr>
        </thead>
        <tbody>
          {PROVAS_DO_SISU.map((p) => (
            <tr key={p} className="border-b border-rule">
              <td className="py-1 pr-2">{nomes[p]}</td>
              <td className="py-1 pr-2">
                <input inputMode="decimal" aria-label={`${s.nota}: ${nomes[p]}`} value={notas[p] ?? ""} onChange={(e) => setNotas({ ...notas, [p]: e.target.value })} className={campo} placeholder="0 a 1000" />
              </td>
              <td className="py-1">
                <input inputMode="decimal" aria-label={`${s.peso}: ${nomes[p]}`} value={pesos[p] ?? "1"} onChange={(e) => setPesos({ ...pesos, [p]: e.target.value })} className={campo} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 font-serif text-2xl" role="status" aria-live="polite">
        {media === null ? s.preencha : fill(s.resultado, { m: media.toFixed(2).replace(".", ",") })}
      </p>
      <p className="mt-2 font-mono text-xs">{s.conta}</p>
    </div>
  );
}
