// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "next/link";
import { useState } from "react";
import { fill, localePath } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import { stageAreas, stages, type AreaSlug, type Stage } from "@/lib/areas";
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

/** Na página inicial, quantas disciplinas cada grupo mostra antes de "ver todas": duas linhas na tela larga. */
const PRIMEIRAS = 6;

/**
 * As disciplinas, com um filtro para quem não quer ver tudo de uma vez: só o essencial, ou só o que
 * tem trilha no ensino fundamental, no médio ou no superior. A escolha fica guardada neste navegador.
 * Em cada grupo vêm primeiro as disciplinas com mais aulas prontas. Na página inicial ("labels") só as
 * primeiras aparecem de cara: quem chega encontra conteúdo, não uma parede de cartões.
 */
export function DisciplineBrowser({ groups, s, stageNames, labels = false }: { labels?: boolean; groups: DisciplineGroup[]; s: Dict["tracks"]; stageNames: Dict["stages"] }) {
  const { lang } = useI18n();
  const hydrated = useHydrated();
  const stored = useStored(KEYS.filter);
  const [abertos, setAbertos] = useState<string[]>([]);
  const filter: Filter = hydrated && (stored === "essencial" || (stages as readonly string[]).includes(stored)) ? (stored as Filter) : "todas";
  const options: [Filter, string][] = [["todas", s.filterAll], ["essencial", s.filterEssential], ...stages.map((stage): [Filter, string] => [stage, stageNames[stage]])];

  const total = (card: DisciplineCard): [number, number] =>
    filter === "todas" || filter === "essencial" ? stages.reduce<[number, number]>((sum, stage) => [sum[0] + card.counts[stage][0], sum[1] + card.counts[stage][1]], [0, 0]) : card.counts[filter];
  const shown = (card: DisciplineCard) => (filter === "todas" ? true : filter === "essencial" ? card.essential : stageAreas[filter].includes(card.slug as AreaSlug));
  // As mais completas primeiro (mais aulas prontas); no empate, vale a ordem de sempre.
  const visible = groups
    .map((group) => ({
      ...group,
      areas: group.areas
        .filter(shown)
        .map((card, i) => ({ card, i }))
        .sort((a, b) => total(b.card)[0] - total(a.card)[0] || a.i - b.i)
        .map(({ card }) => card),
    }))
    .filter((group) => group.areas.length > 0);

  const Title = labels ? "h3" : "h2";

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
      {visible.length > 1 && (
        <nav aria-label={s.jump} className="no-print mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 font-sans text-sm">
          <span className="text-ink-soft">{s.jump}:</span>
          {visible.map((group) => (
            <a key={group.id} href={`#grupo-${group.id}`} className="py-1 underline decoration-rule underline-offset-4 hover:text-oxblood hover:decoration-gold">
              {group.title}
            </a>
          ))}
        </nav>
      )}
      {visible.length === 0 && <p className="mt-10 text-lg text-ink-soft">{s.filterNone}</p>}
      {visible.map((group) => {
        // Esconder uma só não vale o botão: com até uma a mais que o limite, o grupo aparece inteiro.
        const recolhe = labels && group.areas.length > PRIMEIRAS + 1;
        const aberto = !recolhe || abertos.includes(group.id);
        const cards = aberto ? group.areas : group.areas.slice(0, PRIMEIRAS);
        return (
          <section key={group.id} id={`grupo-${group.id}`} className="scroll-mt-24">
            <Title className={labels ? "mt-10 font-sans text-sm font-semibold uppercase tracking-[0.18em] text-gold" : "mt-12 border-b border-rule pb-3 text-3xl font-semibold"}>
              {group.title} <span className="font-normal text-ink-soft">· {group.areas.length}</span>
            </Title>
            <div className={`${labels ? "mt-4" : "mt-6"} grid gap-4 sm:grid-cols-2 lg:grid-cols-3`}>
              {cards.map((card, i) => {
                const [ready, planned] = total(card);
                const anchor = filter === "todas" || filter === "essencial" ? "" : `#${filter}`;
                const parte = planned > 0 ? Math.round((ready / planned) * 100) : 0;
                // O último cartão de uma linha incompleta se estica até o fim: a grade não fica com buraco.
                const ultimo = i === cards.length - 1;
                const sobraDois = cards.length % 2 === 1;
                const sobraTres = cards.length % 3;
                const estica = !ultimo
                  ? ""
                  : `${sobraDois ? "sm:col-span-2" : ""} ${sobraTres === 1 ? "lg:col-span-3" : sobraTres === 2 ? "lg:col-span-2" : sobraDois ? "lg:col-span-1" : ""}`;
                return (
                  <Link key={card.slug} href={`${localePath(lang, `/estantes/${card.slug}`)}${anchor}`} className={`group flex flex-col border border-rule bg-parchment-deep p-5 hover:border-gold ${estica}`}>
                    <p className="text-2xl font-semibold group-hover:text-oxblood">{card.name}</p>
                    <p className="mt-1 text-ink-soft">{card.description}</p>
                    <div className="mt-auto pt-4">
                      <div className="h-1.5 w-full bg-rule/60" role="img" aria-label={fill(s.ready, { a: ready, b: planned })}>
                        <div className="h-full bg-oxblood" style={{ width: `${Math.max(parte, ready > 0 ? 3 : 0)}%` }} />
                      </div>
                      <p className="mt-1.5 font-sans text-sm text-ink-soft" aria-hidden>
                        {fill(s.ready, { a: ready, b: planned })}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
            {recolhe && (
              <button
                type="button"
                aria-expanded={aberto}
                onClick={() => setAbertos((lista) => (aberto ? lista.filter((id) => id !== group.id) : [...lista, group.id]))}
                className="no-print mt-4 cursor-pointer border-2 border-rule px-4 py-2 font-sans text-sm hover:border-gold hover:text-oxblood"
              >
                {aberto ? s.showLess : fill(s.showAll, { n: group.areas.length })}
              </button>
            )}
          </section>
        );
      })}
    </div>
  );
}
