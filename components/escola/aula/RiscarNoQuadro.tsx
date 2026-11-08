// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "@/components/Link";
import { localePath, type Locale } from "@/i18n/config";
import type { TextosDaFormacao } from "@/i18n/escola/formacao";
import { preencher } from "@/lib/escola/textos";
import { setCompleted, useCompleted } from "@/lib/progress";

/**
 * "Terminei: riscar no quadro" (prancha Aula): concluir a aula. Grava no MESMO progresso de /trilhas (lib/progress.ts,
 * com o mesmo lessonId), então concluir aqui risca a aula lá e no Quadro da semana, e concluir lá risca aqui. Depois de
 * riscada, aparece a próxima aula do caderno (ou a volta ao caderno).
 */
export function RiscarNoQuadro({ lang, aula, perguntas, proxima, caderno, t }: { lang: Locale; aula: string; perguntas: number; proxima: { codigo: string; titulo: string; href: string } | null; caderno: string; t: TextosDaFormacao["aula"] }) {
  const feita = useCompleted().has(aula);
  return (
    <div className="efa-riscar no-print">
      <span className="efa-riscar-texto">{perguntas > 0 ? preencher(t.fim, { n: perguntas }) : t.fimSemQuiz}</span>
      <button type="button" className={feita ? "efa-riscada" : "ef-botao-vermelho"} aria-pressed={feita} onClick={() => setCompleted(aula, !feita)}>
        {feita ? `✓ ${t.riscada}` : t.riscar}
      </button>
      {feita && (
        <p className="efa-depois">
          {proxima ? (
            <Link href={localePath(lang, proxima.href)} className="efa-link-forte">
              {preencher(t.proxima, { codigo: proxima.codigo, titulo: proxima.titulo })} →
            </Link>
          ) : (
            <Link href={localePath(lang, caderno)} className="efa-link-forte">
              {t.voltarCaderno} →
            </Link>
          )}
          <button type="button" className="efa-botao-texto" onClick={() => setCompleted(aula, false)}>
            {t.desriscar}
          </button>
        </p>
      )}
    </div>
  );
}
