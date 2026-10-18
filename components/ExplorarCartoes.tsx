// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { normalize } from "@/lib/text";
import { L, useI18n } from "./I18n";

export interface SecaoDoExplorar {
  title: string;
  items: { label: string; path: string; description: string }[];
}

/** Os cartões do "Mais", por objetivo, com um campo que filtra enquanto a pessoa digita. */
export function ExplorarCartoes({ sections }: { sections: SecaoDoExplorar[] }) {
  const { t } = useI18n();
  const [digitado, setDigitado] = useState("");
  const termo = normalize(digitado.trim());
  const filtradas = sections.map((s) => ({ ...s, items: s.items.filter((i) => !termo || normalize(`${i.label} ${i.description}`).includes(termo)) })).filter((s) => s.items.length > 0);
  return (
    <>
      <label className="mt-6 block max-w-md font-sans text-sm">
        {t.lists.find}
        <input type="search" value={digitado} onChange={(e) => setDigitado(e.target.value)} maxLength={60} className="mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2" />
      </label>
      {filtradas.length === 0 && <p className="mt-6 text-lg text-ink-soft">{t.lists.none}</p>}
      {filtradas.map((section) => (
        <section key={section.title}>
          <h2 className="mt-12 border-b border-rule pb-3 text-3xl font-semibold max-md:mt-7 max-md:border-0 max-md:px-1 max-md:pb-0 max-md:font-mono max-md:text-xs! max-md:font-normal max-md:uppercase max-md:tracking-[0.2em] max-md:text-gold">{section.title}</h2>
          <div className="mt-6 grid gap-4 max-md:mt-2 max-md:gap-0 max-md:overflow-hidden max-md:border-2 max-md:border-ink max-md:bg-parchment-deep sm:grid-cols-2">
            {section.items.map((item) => (
              <L
                key={item.path}
                href={item.path}
                className="group flex items-center justify-between gap-3 border border-rule bg-parchment-deep p-5 hover:border-gold max-md:border-0 max-md:border-b max-md:bg-transparent max-md:px-4 max-md:py-3 max-md:last:border-b-0"
              >
                <span className="block min-w-0">
                  <span className="block text-2xl font-semibold group-hover:text-oxblood max-md:text-lg max-md:leading-snug">{item.label}</span>
                  <span className="mt-1 block text-ink-soft max-md:mt-0.5 max-md:line-clamp-2 max-md:font-sans max-md:text-[0.8rem] max-md:leading-snug">{item.description}</span>
                </span>
                <span aria-hidden className="hidden shrink-0 font-sans text-2xl leading-none text-ink-soft max-md:block">›</span>
              </L>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
