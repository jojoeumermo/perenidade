// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { fill } from "@/i18n/config";
import type { ExercicioNovo } from "@/lib/exercicios";
import type { TextosDoEstudo } from "@/lib/textos-estudo";
import { L } from "../I18n";
import { CartaoDeExercicio } from "./Exercicio";

type S = TextosDoEstudo["exercicios"];

/**
 * Os exercícios com explicação do erro de uma aula (recurso "exercicios"): ficam abaixo do teste de fim de aula,
 * com filtro por dificuldade. Tudo é corrigido no aparelho; o que a pessoa responde fica só nele.
 */
export function ExerciciosComExplicacao({ exercicios, aula, s, corrigir, praticar }: { exercicios: ExercicioNovo[]; aula: string; s: S; corrigir: string; praticar?: string }) {
  const [nivel, setNivel] = useState(0);
  const vistos = exercicios.filter((ex) => !nivel || ex.dificuldade === nivel);
  const emRevisao = exercicios.some((ex) => ex.revisao.status === "em-revisao");
  return (
    <section aria-labelledby="exercicios-titulo" className="no-print mt-12">
      <h2 id="exercicios-titulo" className="text-2xl font-semibold">
        {s.titulo}
      </h2>
      <p className="mt-2 font-sans text-sm text-ink-soft">{s.lead}</p>
      {emRevisao && <p className="mt-3 border-l-2 border-gold pl-4 font-sans text-sm text-ink-soft">{s.avisoEmRevisao}</p>}
      <fieldset className="mt-4 font-sans text-sm">
        <legend className="text-ink-soft">{s.filtrar}</legend>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {[0, 1, 2, 3].map((n) => (
            <label key={n} className={`cursor-pointer border-2 px-3 py-1 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-gold ${nivel === n ? "border-ink bg-ink text-parchment" : "border-rule hover:border-gold"}`}>
              <input type="radio" name={`nivel-${aula}`} className="sr-only" checked={nivel === n} onChange={() => setNivel(n)} />
              {n === 0 ? fill(s.todos, { n: exercicios.length }) : fill(s.nivel, { n, q: exercicios.filter((ex) => ex.dificuldade === n).length })}
            </label>
          ))}
        </div>
      </fieldset>
      <ol className="mt-5 space-y-5">
        {vistos.map((ex, i) => (
          <li key={ex.id}>
            <CartaoDeExercicio ex={ex} aula={aula} s={s} posicao={fill(s.posicao, { i: i + 1, n: vistos.length })} corrigir={corrigir} />
          </li>
        ))}
      </ol>
      {praticar && (
        <p className="mt-5 font-sans text-sm">
          <L href={praticar} className="underline hover:text-oxblood">
            {s.irParaPraticar} →
          </L>
        </p>
      )}
    </section>
  );
}
