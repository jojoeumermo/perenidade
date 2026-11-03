// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { fill } from "@/i18n/config";
import { useMissoes, useTarefas } from "./guardado-vida";

/** "N de M tarefas feitas · N de M missões", só para quem estuda, neste aparelho, sem ranking. */
export function ResumoDaVida({ tarefas, missoes, s }: { tarefas: number; missoes: number; s: { tarefas: string; missoes: string } }) {
  const nTarefas = Object.keys(useTarefas()).length;
  const nMissoes = Object.keys(useMissoes()).length;
  return (
    <p className="vida-nota" role="status" data-resumo-da-vida="">
      {fill(s.tarefas, { n: nTarefas, m: tarefas })} · {fill(s.missoes, { n: nMissoes, m: missoes })}
    </p>
  );
}