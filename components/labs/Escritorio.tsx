// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import type { Dict } from "@/i18n/types";
import { editor, ESCRITORIO } from "@/lib/estudio";
import { QuadroDoEditor } from "../EstudioDePratica";

type Id = (typeof ESCRITORIO)[number];
/** Os textos vêm do dicionário do site (laboratório) ou escritos no painel (que tem tradução própria). */
export type TextosDoEscritorio = Pick<Dict["practiceStudio"], "code" | "insideNote" | "fullscreen" | "notYet"> & {
  editors: Record<Id, { text: string }>;
  tab: string;
  local: string;
};

/**
 * O laboratório de escritório: WordCraft, GridCraft e DeckCraft (do projeto ArtCraft), abertos dentro da página, num
 * quadro do estúdio (outra origem, sem acesso à sessão). O mesmo componente aparece no painel da equipe.
 */
export function Escritorio({ s, inicial = "gridcraft" }: { s: TextosDoEscritorio; inicial?: Id }) {
  const [atual, setAtual] = useState<Id>(inicial);
  const ed = editor(atual)!;
  return (
    <div className="font-sans">
      <div role="tablist" aria-label={s.tab} className="mt-6 grid gap-2 sm:grid-cols-3">
        {ESCRITORIO.map((id) => {
          const e = editor(id)!;
          const textos = s.editors[id];
          const ativo = id === atual;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={ativo}
              onClick={() => setAtual(id)}
              className={`cursor-pointer border-2 p-3 text-left ${ativo ? "border-oxblood bg-parchment-deep" : "border-rule hover:border-ink"}`}
            >
              <span className="block font-serif text-xl font-semibold">{e.nome}</span>
              <span className="block text-sm text-ink-soft">{textos.text}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-sm text-ink-soft">
        {s.local}{" "}
        <span className="font-mono text-xs">{ed.nome} {ed.versao} · {ed.licenca} · </span>
        <a href={ed.repositorio} target="_blank" rel="noopener noreferrer" className="text-xs underline hover:text-oxblood">{s.code} ↗</a>
      </p>
      <QuadroDoEditor key={atual} s={s} id={atual} nome={ed.nome} />
    </div>
  );
}
