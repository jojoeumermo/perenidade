// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState, type ReactNode } from "react";
import type { Dict } from "@/i18n/types";
import { fill } from "@/i18n/config";
import { L, useI18n } from "./I18n";

export interface GlossaryItem {
  slug: string;
  term: string;
  summary: string;
  areas: string[];
  lessons: { href: string; title: string }[];
  original: boolean;
  /** O texto longo do verbete, já montado no servidor. */
  body: ReactNode;
}

/** A lista do glossário, com busca por palavra e filtro pela disciplina em que o termo é usado. */
export function GlossaryList({ items, s }: { items: GlossaryItem[]; s: Dict["glossary"] }) {
  const { t } = useI18n();
  const [area, setArea] = useState("");
  const [typed, setTyped] = useState("");
  const name = (slug: string) => t.areas[slug as keyof typeof t.areas]?.[0] ?? slug;
  const areas = [...new Set(items.flatMap((item) => item.areas))].sort((a, b) => name(a).localeCompare(name(b)));
  const wanted = typed.trim().toLowerCase();
  const shown = items.filter((item) => (!area || item.areas.includes(area)) && (!wanted || item.term.toLowerCase().includes(wanted) || item.summary.toLowerCase().includes(wanted)));
  const original = (item: GlossaryItem) => (item.original ? { lang: "pt-BR" } : {});

  return (
    <>
      <div className="no-print mt-8 grid gap-3 font-sans text-sm sm:grid-cols-2">
        <label className="block">
          {s.filter}
          <select value={area} onChange={(e) => setArea(e.target.value)} className="mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2">
            <option value="">{s.all}</option>
            {areas.map((slug) => (
              <option key={slug} value={slug}>
                {name(slug)} ({items.filter((item) => item.areas.includes(slug)).length})
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          {s.find}
          <input type="search" value={typed} onChange={(e) => setTyped(e.target.value)} maxLength={60} className="mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2" />
        </label>
      </div>
      <p className="mt-3 font-mono text-xs text-ink-soft" role="status">{fill(s.count, { n: shown.length })}</p>
      <nav aria-label={s.title} className="mt-4 flex flex-wrap gap-x-4 gap-y-1 font-sans text-sm">
        {shown.map((item) => (
          <a key={item.slug} href={`#${item.slug}`} className="underline hover:text-oxblood" {...original(item)}>{item.term}</a>
        ))}
      </nav>
      <dl className="mt-10 space-y-8">
        {shown.map((item) => (
          <div key={item.slug} id={item.slug} className="scroll-mt-6 border-l-2 border-gold pl-5" {...original(item)}>
            <dt className="text-3xl font-semibold">{item.term}</dt>
            <dd className="mt-2">
              <p className="text-xl italic text-ink-soft">{item.summary}</p>
              {item.body && <div className="mt-3">{item.body}</div>}
              {item.lessons.length > 0 && (
                <p className="mt-3 font-sans text-sm text-ink-soft">
                  {s.usedIn}{" "}
                  {item.lessons.map((lesson, i) => (
                    <span key={lesson.href}>
                      {i > 0 && " · "}
                      <L href={lesson.href} className="underline hover:text-oxblood">{lesson.title}</L>
                    </span>
                  ))}
                </p>
              )}
            </dd>
          </div>
        ))}
      </dl>
      {shown.length === 0 && <p className="mt-6 text-lg text-ink-soft">{s.none}</p>}
    </>
  );
}
