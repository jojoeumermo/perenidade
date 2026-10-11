// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { localePath, plural } from "@/i18n/config";
import { areaSlugs, licenses } from "@/lib/areas";
import type { Book, CatalogEntry } from "@/lib/content";
import { normalize } from "@/lib/text";
import { BookCard, licenseName } from "./Cards";
import { useI18n } from "./I18n";

const field = "border-2 border-ink bg-parchment-deep px-3 py-2";

export function AcervoBrowser({ books }: { books: Book[] }) {
  const { lang, t } = useI18n();
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [area, setArea] = useState(params.get("area") ?? "");
  const [license, setLicense] = useState("");
  const [catalog, setCatalog] = useState<{ key: string; entries: CatalogEntry[] }>({ key: "", entries: [] });

  const terms = normalize(query).split(/\s+/).filter(Boolean);
  const results = books.filter((book) => {
    if (area && book.area !== area) return false;
    if (license && book.license !== license) return false;
    const haystack = normalize(`${book.title} ${book.author} ${book.synopsis} ${book.source}`);
    return terms.every((term) => haystack.includes(term));
  });

  // Os catálogos abertos são grandes: só são baixados quando a pessoa escolhe uma disciplina ou busca algo.
  const wanted = area || (terms.join("").length >= 3 ? "todos" : "");
  useEffect(() => {
    if (!wanted || wanted === catalog.key) return;
    let cancelled = false;
    fetch(localePath(lang, `/catalogo/${wanted}`))
      .then((response) => (response.ok ? (response.json() as Promise<CatalogEntry[]>) : []))
      .then((entries) => {
        if (!cancelled) setCatalog({ key: wanted, entries });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [wanted, catalog.key, lang]);

  const fromCatalog =
    wanted && catalog.key === wanted && !license
      ? catalog.entries.filter((entry) => terms.every((term) => normalize(`${entry.t} ${entry.a}`).includes(term))).slice(0, 200)
      : [];

  return (
    <>
      <div role="search" className="mt-8 flex flex-wrap gap-3 font-sans text-sm">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={t.library.searchLabel}
          placeholder={t.library.searchPlaceholder}
          className={`${field} min-w-60 flex-1 font-mono outline-none`}
        />
        <select value={area} onChange={(e) => setArea(e.target.value)} aria-label={t.library.area} className={field}>
          <option value="">{t.library.allAreas}</option>
          {areaSlugs.map((slug) => (
            <option key={slug} value={slug}>
              {t.areas[slug][0]}
            </option>
          ))}
        </select>
        <select value={license} onChange={(e) => setLicense(e.target.value)} aria-label={t.library.license} className={field}>
          <option value="">{t.library.allLicenses}</option>
          {licenses.map((l) => (
            <option key={l} value={l}>
              {licenseName(t, l)}
            </option>
          ))}
        </select>
      </div>

      <p role="status" className="mt-6 font-mono text-xs text-ink-soft">
        {plural(lang, results.length + fromCatalog.length, t.common.works)}
      </p>
      <div className="mt-4 grid gap-5 md:grid-cols-2">
        {results.map((book) => (
          <BookCard key={book.id} book={book} lang={lang} t={t} />
        ))}
      </div>
      {fromCatalog.length > 0 && (
        <section className="mt-10">
          <h2 className="border-b border-rule pb-3 text-2xl font-semibold">{t.library.catalogTitle}</h2>
          <p className="mt-3 font-sans text-sm text-ink-soft">{t.library.catalogLead}</p>
          <ul className="mt-4 space-y-1.5 font-sans text-sm">
            {fromCatalog.map((entry) => (
              <li key={entry.u}>
                <a href={entry.u} target="_blank" rel="noopener noreferrer" className="underline hover:text-oxblood">{entry.t}</a>
                <span className="text-ink-soft"> · {entry.a} · {entry.i} · {entry.f}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {results.length + fromCatalog.length === 0 && <p className="mt-8 text-xl text-ink-soft">{t.library.nothing}</p>}
    </>
  );
}
