// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import type { TextosDoEstudo } from "@/lib/textos-estudo";
import { type FonteDaProva, ProvaOficial } from "./ProvaOficial";

export interface OpcaoDeLista {
  id: string;
  titulo: string;
  detalhe: string;
  ids: string[];
  minutos: number;
}

/**
 * Uma lista de provas curtas para escolher (as áreas do diagnóstico, os minissimulados): a pessoa escolhe uma e ela
 * abre ali mesmo, com a mesma folha de respostas e o mesmo relatório das provas oficiais.
 */
export function EscolherLista({ opcoes, diagnostico, rotuloAbrir, habilidades, areas, s }: { opcoes: OpcaoDeLista[]; diagnostico?: boolean; rotuloAbrir: string; habilidades: Record<string, string>; areas: Record<string, string>; s: TextosDoEstudo["enem"] }) {
  const [aberta, setAberta] = useState<OpcaoDeLista | null>(null);
  if (aberta) {
    const fonte: FonteDaProva = { tipo: "lista", id: aberta.id, titulo: aberta.titulo, ids: aberta.ids, minutos: aberta.minutos, diagnostico };
    return (
      <div>
        <p className="mt-6 font-sans text-sm">
          <button type="button" className="cursor-pointer underline hover:text-oxblood" onClick={() => setAberta(null)}>← {aberta.titulo}</button>
        </p>
        <ProvaOficial key={aberta.id} fonte={fonte} habilidades={habilidades} areas={areas} s={s} />
      </div>
    );
  }
  return (
    <ul className="mt-6 grid gap-3 font-sans text-sm sm:grid-cols-2">
      {opcoes.map((o) => (
        <li key={o.id} className="border-2 border-ink bg-parchment-deep p-4">
          <p className="font-serif text-xl font-semibold">{o.titulo}</p>
          <p className="mt-1 text-ink-soft">{o.detalhe}</p>
          <button type="button" className="mt-3 cursor-pointer bg-ink px-4 py-2 font-semibold text-parchment hover:bg-oxblood" onClick={() => setAberta(o)}>
            {rotuloAbrir}
          </button>
        </li>
      ))}
    </ul>
  );
}
