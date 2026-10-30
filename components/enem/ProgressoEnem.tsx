// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { fill } from "@/i18n/config";
import { lerEnem, type Placar, type ResultadoDeProva } from "@/lib/enem-aparelho";
import type { TextosDoEstudo } from "@/lib/textos-estudo";
import { L } from "../I18n";

/**
 * O progresso no curso ENEM, dentro do Meu estudo: descritivo, sem placar nem comparação. As provas e simulados que a
 * pessoa fez neste aparelho e, somando tudo, os acertos por área e as habilidades que mais pedem revisão.
 */
export function ProgressoEnem({ areas, habilidades, s }: { areas: Record<string, string>; habilidades: Record<string, string>; s: TextosDoEstudo["enem"]["progresso"] }) {
  const [provas, setProvas] = useState<ResultadoDeProva[]>([]);
  useEffect(() => {
    const ler = () => setProvas(lerEnem().provas);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- o que a pessoa fez só existe no navegador
    ler();
    window.addEventListener("lucia:estudo", ler);
    return () => window.removeEventListener("lucia:estudo", ler);
  }, []);
  if (!provas.length) return null;
  const somar = (campo: "porArea" | "porHabilidade") => {
    const total: Record<string, Placar> = {};
    for (const p of provas) for (const [k, [a, t]] of Object.entries(p[campo])) total[k] = [(total[k]?.[0] ?? 0) + a, (total[k]?.[1] ?? 0) + t];
    return total;
  };
  const porArea = somar("porArea");
  const revisar = Object.entries(somar("porHabilidade"))
    .filter(([, [, t]]) => t >= 2)
    .sort((x, y) => x[1][0] / x[1][1] - y[1][0] / y[1][1])
    .slice(0, 5);
  return (
    <section className="mt-10 border-2 border-ink bg-parchment-deep p-5 font-sans text-sm">
      <h2 className="font-serif text-2xl font-semibold">{s.titulo}</h2>
      <p className="mt-1 text-ink-soft">{s.lead}</p>
      <h3 className="mt-4 font-semibold">{s.porArea}</h3>
      <ul className="mt-1 space-y-1">
        {Object.entries(porArea).map(([a, [x, t]]) => (
          <li key={a}>{fill(s.linhaArea, { area: areas[a] ?? a, a: x, b: t })}</li>
        ))}
      </ul>
      {revisar.length > 0 && (
        <>
          <h3 className="mt-4 font-semibold">{s.revisar}</h3>
          <ul className="mt-1 space-y-1">
            {revisar.map(([k, [x, t]]) => {
              const [area, h] = k.split("-");
              return (
                <li key={k}>
                  <L href={`/enem/praticar?area=${area}&habilidade=${h}`} className="underline hover:text-oxblood">
                    {areas[area] ?? area}, H{h}: {habilidades[k] ?? ""}
                  </L>{" "}
                  ({x}/{t})
                </li>
              );
            })}
          </ul>
        </>
      )}
      <h3 className="mt-4 font-semibold">{s.feitas}</h3>
      <ul className="mt-1 space-y-1">
        {provas.slice(0, 10).map((p) => (
          <li key={`${p.id}-${p.quando}`}>{fill(s.linhaProva, { titulo: p.titulo, data: new Date(p.quando).toLocaleDateString(), a: p.acertos, b: p.total })}</li>
        ))}
      </ul>
    </section>
  );
}
