// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
"use client";

import Link from "next/link";
import { fill, localePath } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import { stages, type Stage } from "@/lib/areas";
import { KEYS, setItem, useHydrated, useStored } from "@/lib/storage";
import { useI18n } from "./I18n";

export interface DisciplineCard {
  slug: string;
  name: string;
  description: string;
  essential: boolean;
  /** Aulas prontas e planejadas em cada etapa. */
  counts: Record<Stage, [number, number]>;
}

export interface DisciplineGroup {
  id: string;
  title: string;
  areas: DisciplineCard[];
}

type Filter = "todas" | "essencial" | Stage;

/**
 * As disciplinas, com um filtro para quem não quer ver tudo de uma vez: só o essencial, ou só o que
 * tem trilha no ensino fundamental, no médio ou no superior. A escolha fica guardada neste navegador.
 */
export function DisciplineBrowser({ groups, s, stageNames }: { groups: DisciplineGroup[]; s: Dict["tracks"]; stageNames: Dict["stages"] }) {
  const { lang } = useI18n();
  const hydrated = useHydrated();
  const stored = useStored(KEYS.filter);
  const filter: Filter = hydrated && (stored === "essencial" || (stages as readonly string[]).includes(stored)) ? (stored as Filter) : "todas";
  const options: [Filter, string][] = [["todas", s.filterAll], ["essencial", s.filterEssential], ...stages.map((stage): [Filter, string] => [stage, stageNames[stage]])];

  const total = (card: DisciplineCard): [number, number] =>
    filter === "todas" || filter === "essencial" ? stages.reduce<[number, number]>((sum, stage) => [sum[0] + card.counts[stage][0], sum[1] + card.counts[stage][1]], [0, 0]) : card.counts[filter];
  const shown = (card: DisciplineCard) => (filter === "todas" ? true : filter === "essencial" ? card.essential : card.counts[filter][1] > 0);
  const visible = groups.map((group) => ({ ...group, areas: group.areas.filter(shown) })).filter((group) => group.areas.length > 0);

  return (
    <div>
      <div role="group" aria-label={s.filter} className="no-print mt-8 flex flex-wrap items-center gap-2 font-sans text-sm">
        <span className="mr-1 text-ink-soft">{s.filter}:</span>
        {options.map(([value, label]) => (
          <button key={value} type="button" onClick={() => setItem(KEYS.filter, value === "todas" ? null : value)} aria-pressed={filter === value} className={`cursor-pointer border-2 px-3 py-1.5 ${filter === value ? "border-ink bg-ink text-parchment" : "border-rule hover:border-gold"}`}>
            {label}
          </button>
        ))}
      </div>
      {filter === "essencial" && <p className="mt-3 font-sans text-sm text-ink-soft">{s.filterEssentialHint}</p>}
      {visible.length === 0 && <p className="mt-10 text-lg text-ink-soft">{s.filterNone}</p>}
      {visible.map((group) => (
        <section key={group.id}>
          <h2 className="mt-12 border-b border-rule pb-3 text-3xl font-semibold">{group.title}</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {group.areas.map((card) => {
              const [ready, planned] = total(card);
              const anchor = filter === "todas" || filter === "essencial" ? "" : `#${filter}`;
              return (
                <Link key={card.slug} href={`${localePath(lang, `/estantes/${card.slug}`)}${anchor}`} className="group border border-rule bg-parchment-deep p-5 hover:border-gold">
                  <p className="font-mono text-xs text-gold">{fill(s.ready, { a: ready, b: planned })}</p>
                  <p className="mt-2 text-2xl font-semibold group-hover:text-oxblood">{card.name}</p>
                  <p className="mt-1 text-ink-soft">{card.description}</p>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
