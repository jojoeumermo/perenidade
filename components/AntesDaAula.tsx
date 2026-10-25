// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "@/components/Link";
import { useState } from "react";
import { localePath } from "@/i18n/config";
import type { AulaLigada } from "@/lib/content";
import { useCompleted } from "@/lib/progress";
import { getItem, setItem, useHydrated } from "@/lib/storage";
import { useI18n } from "./I18n";

const CHAVE = "lucia:requisitos-vistos";

/**
 * Antes desta aula: o que é bom ter visto antes (o campo "requisitos" da aula ou, sem ele, a aula anterior da trilha),
 * com ✓ no que a pessoa já concluiu neste aparelho. Só aparece quando falta algo; não tranca nada: quem já sabe aperta
 * "Já sei isso" e o aviso some para esta aula.
 */
export function AntesDaAula({ aula, requisitos }: { aula: string; requisitos: AulaLigada[] }) {
  const { lang, t } = useI18n();
  const s = t.lesson;
  const hidratado = useHydrated();
  const feitas = useCompleted();
  const [dispensado, setDispensado] = useState(false);
  if (!hidratado || requisitos.length === 0 || dispensado) return null;
  let vistos: string[] = [];
  try {
    vistos = JSON.parse(getItem(CHAVE) || "[]") as string[];
  } catch {
    vistos = [];
  }
  const faltam = requisitos.filter((r) => !feitas.has(r.id));
  if (faltam.length === 0 || vistos.includes(aula)) return null;
  return (
    <aside aria-label={s.beforeTitle} className="no-print mt-6 border-2 border-ink bg-parchment-deep p-4 font-sans text-sm">
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-oxblood">{s.beforeTitle}</p>
      <p className="mt-1">{s.beforeLead}</p>
      <ul className="mt-2 space-y-1">
        {requisitos.map((r) => (
          <li key={r.id} className="flex items-start gap-2">
            <span aria-hidden className={feitas.has(r.id) ? "text-ok" : "text-ink-soft"}>{feitas.has(r.id) ? "✓" : "○"}</span>
            <span>
              <Link href={localePath(lang, r.path)} className="font-semibold underline hover:text-oxblood">{r.title}</Link>
              <span className="text-ink-soft"> · {r.track}</span>
              <span className="sr-only">{feitas.has(r.id) ? ` (${s.beforeDone})` : ` (${s.beforeMissing})`}</span>
            </span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => {
          setItem(CHAVE, JSON.stringify([...vistos, aula].slice(-500)));
          setDispensado(true);
        }}
        className="mt-3 cursor-pointer border-2 border-ink px-3 py-1 font-semibold hover:border-oxblood hover:text-oxblood"
      >
        {s.beforeKnow}
      </button>
    </aside>
  );
}
