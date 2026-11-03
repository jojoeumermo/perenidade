// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useSyncExternalStore } from "react";
import { L } from "@/components/I18n";
import { fill } from "@/i18n/config";
import { type Feriado, feriadoDoDia } from "@/lib/escola/calendario";
import type { TextosDoCampus } from "@/lib/escola/campus-servidor";
import { hojeEmBrasilia } from "@/lib/escola/tempo";

const nunca = () => () => {};

/** O dia de hoje em Brasília no navegador; no servidor e na hidratação, null (a página é feita antes do dia). */
export const useHojeNaEscola = () => useSyncExternalStore(nunca, () => hojeEmBrasilia(), () => null);

/**
 * A faixa do feriado do campus (E4-09, D1-7): só no dia, "Hoje é feriado no campus: <nome>", com o link da fonte e a
 * aula do tema, se houver. Feriado não tira aula do plano: a faixa só sugere descanso ou a aula do tema.
 */
export function FeriadoDoCampus({ feriados, s }: { feriados: Feriado[]; s: TextosDoCampus["feriado"] }) {
  const hoje = useHojeNaEscola();
  const feriado = hoje ? feriadoDoDia(hoje, feriados) : null;
  if (!feriado) return null;
  return (
    <aside className="no-print mx-auto max-w-5xl px-4 pt-4" data-feriado-do-campus={feriado.dia}>
      <div className="border-l-4 border-oxblood bg-parchment-deep px-4 py-3 font-sans text-sm">
        <p className="font-semibold text-ink">{fill(s.faixa, { nome: feriado.nome })}</p>
        <p className="mt-1 text-ink-soft">{s.descanso}</p>
        <p className="mt-1 flex flex-wrap gap-x-4">
          {feriado.aula && (
            <L href={`/trilhas/${feriado.aula}`} className="inline-flex min-h-11 items-center font-semibold text-oxblood underline underline-offset-4">
              {s.aula} →
            </L>
          )}
          <a href={feriado.fonte} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-ink-soft underline underline-offset-4 hover:text-oxblood">
            {s.fonte} ↗
          </a>
        </p>
      </div>
    </aside>
  );
}
