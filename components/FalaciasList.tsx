// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState, type ReactNode } from "react";
import { fill } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import { normalize } from "@/lib/text";
import { L } from "./I18n";

export interface FalaciaItem {
  slug: string;
  name: string;
  original?: string;
  summary: string;
  family: string;
  what: string;
  everyday: string;
  publicDebate: string;
  reply: string;
  related: { slug: string; name: string }[];
  /** Cartões de debate que usam esta falácia. */
  debates: { slug: string; claim: string }[];
  untranslated: boolean;
  /** Fontes e texto longo, já montados no servidor. */
  extra: ReactNode;
}

/** O guia das falácias: busca por palavra, filtro pelo tipo e uma ficha por falácia, com âncora para citar. */
export function FalaciasList({ items, s }: { items: FalaciaItem[]; s: Dict["fallacies"] }) {
  const [family, setFamily] = useState("");
  const [typed, setTyped] = useState("");
  const families = s.families as Record<string, string>;
  const wanted = normalize(typed.trim());
  const shown = items.filter(
    (item) => (!family || item.family === family) && (!wanted || normalize(`${item.name} ${item.original ?? ""} ${item.summary}`).includes(wanted)),
  );
  const original = (item: FalaciaItem) => (item.untranslated ? { lang: "pt-BR" } : {});

  return (
    <>
      <div className="no-print mt-8 grid gap-3 font-sans text-sm sm:grid-cols-2">
        <label className="block">
          {s.filter}
          <select value={family} onChange={(e) => setFamily(e.target.value)} className="mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2">
            <option value="">{s.all}</option>
            {Object.entries(families).map(([id, label]) => (
              <option key={id} value={id}>
                {label} ({items.filter((item) => item.family === id).length})
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
          <a key={item.slug} href={`#${item.slug}`} className="underline hover:text-oxblood" {...original(item)}>{item.name}</a>
        ))}
      </nav>
      <div className="mt-10 space-y-8">
        {shown.map((item) => (
          <article key={item.slug} id={item.slug} className="scroll-mt-6 border-t-8 border-ink bg-parchment-deep p-6" {...original(item)}>
            <p className="jornal-editoria">{families[item.family] ?? item.family}</p>
            <h2 className="jornal-manchete mt-3 text-2xl sm:text-3xl">{item.name}</h2>
            {item.original && <p className="mt-1 font-serif text-lg italic text-ink-soft">{item.original}</p>}
            <p className="mt-3 border-l-4 border-[#c21f16] pl-4 text-xl leading-relaxed">{item.summary}</p>
            <dl className="mt-5 space-y-4">
              {(
                [
                  [s.what, item.what],
                  [s.everyday, item.everyday],
                  [s.publicDebate, item.publicDebate],
                  [s.reply, item.reply],
                ] as const
              ).map(([label, text]) => (
                <div key={label}>
                  <dt className="font-mono text-xs uppercase tracking-widest text-gold">{label}</dt>
                  <dd className="mt-1 text-lg leading-relaxed">{text}</dd>
                </div>
              ))}
            </dl>
            {item.related.length > 0 && (
              <p className="mt-5 font-sans text-sm">
                <span className="text-ink-soft">{s.related}: </span>
                {item.related.map((other, i) => (
                  <span key={other.slug}>
                    {i > 0 && " · "}
                    <a href={`#${other.slug}`} onClick={() => { setFamily(""); setTyped(""); }} className="underline hover:text-oxblood">{other.name}</a>
                  </span>
                ))}
              </p>
            )}
            {item.debates.length > 0 && (
              <p className="mt-2 font-sans text-sm">
                <span className="text-ink-soft">{s.inDebates}: </span>
                {item.debates.map((card, i) => (
                  <span key={card.slug}>
                    {i > 0 && " · "}
                    <L href={`/debates#${card.slug}`} className="underline hover:text-oxblood">“{card.claim}”</L>
                  </span>
                ))}
              </p>
            )}
            {item.extra}
          </article>
        ))}
      </div>
      {shown.length === 0 && <p className="mt-6 text-lg text-ink-soft">{s.none}</p>}
    </>
  );
}
