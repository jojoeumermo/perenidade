// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { fill, localePath } from "@/i18n/config";
import { esquecerTurma, lerTurmas, type TurmaGuardada } from "@/lib/meu-estudo";
import { useCompleted } from "@/lib/progress";
import type { TextosDoEstudo } from "@/lib/textos-estudo";
import { useI18n } from "../I18n";
import { Barra } from "./Barra";
import { useGuardado } from "./guardado";

/** As turmas abertas por link neste aparelho (recurso "turma"), dentro do "Meu estudo", com o progresso de cada uma. */
export function MinhasTurmas({ s }: { s: TextosDoEstudo["turma"] }) {
  const { lang } = useI18n();
  const feitas = useCompleted();
  const [turmas, recarregar] = useGuardado<TurmaGuardada[]>(lerTurmas, []);
  if (turmas.length === 0) return null;
  return (
    <section aria-labelledby="me-turmas" className="border border-rule bg-parchment-deep p-5">
      <h2 id="me-turmas" className="font-serif text-2xl font-semibold">
        {s.minhasTurmas}
      </h2>
      <ul className="mt-3 space-y-4">
        {turmas.map((t) => {
          const feitasAqui = t.aulas.filter((id) => feitas.has(id)).length;
          return (
            <li key={t.codigo}>
              <p className="flex flex-wrap justify-between gap-x-3">
                <a href={`${localePath(lang, "/turma")}#${t.link}`} className="underline hover:text-oxblood">
                  {t.titulo}
                </a>
                <span className="font-mono text-xs text-ink-soft">{fill(s.deAulas, { a: feitasAqui, b: t.aulas.length })}</span>
              </p>
              <div className="mt-1">
                <Barra feito={feitasAqui} total={t.aulas.length} rotulo={t.titulo} />
              </div>
              <button type="button" className="mt-1 cursor-pointer text-xs text-ink-soft underline hover:text-oxblood" onClick={() => { esquecerTurma(t.codigo); recarregar(); }}>
                {s.esquecer}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
