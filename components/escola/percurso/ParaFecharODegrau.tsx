// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import type { TextosDoPercurso } from "@/i18n/escola/percurso";
import type { FaltaNoDegrau } from "@/lib/escola/conquistas";
import { preencher } from "@/lib/escola/textos";

type Plurais = TextosDoPercurso["fechar"]["cadernos"];

function plural(formas: Plurais, n: number, lang: string): string {
  let forma: keyof Plurais = "other";
  try {
    const f = new Intl.PluralRules(lang).select(n);
    if (f in formas) forma = f as keyof Plurais;
  } catch {
    forma = n === 1 ? "one" : "other";
  }
  return preencher(formas[forma], { n });
}

function juntar(itens: string[], lang: string): string {
  try {
    return new Intl.ListFormat(lang, { type: "conjunction" }).format(itens);
  } catch {
    return itens.join(", ");
  }
}

/**
 * "Para fechar o Degrau N" (prancha Cel-Percurso): os cadernos do degrau ainda abertos, as tarefas no mundo que faltam
 * (contadas neste aparelho) e, sempre, o balanço com o núcleo: só a banca de passagem sobe o degrau, no servidor (F4).
 */
export function ParaFecharODegrau({ falta, t, lang }: { falta: FaltaNoDegrau; t: TextosDoPercurso["fechar"]; lang: string }) {
  const itens: string[] = [];
  if (falta.cadernos > 0) itens.push(plural(t.cadernos, falta.cadernos, lang));
  if (falta.tarefas > 0) itens.push(plural(t.tarefas, falta.tarefas, lang));
  const frase = itens.length === 0 ? preencher(t.faltaSo, { item: t.balanco }) : preencher(t.faltam, { lista: juntar([...itens, t.balanco], lang) });
  return (
    <section aria-labelledby="ep-fechar" className="ep-fechar">
      <h2 id="ep-fechar" className="ef-t">
        {preencher(t.titulo, { n: falta.degrau })}
      </h2>
      <p>{frase}</p>
    </section>
  );
}
