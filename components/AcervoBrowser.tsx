"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { plural } from "@/i18n/config";
import { areaSlugs, licenses } from "@/lib/areas";
import type { Book } from "@/lib/content";
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

  const terms = normalize(query).split(/\s+/).filter(Boolean);
  const results = books.filter((book) => {
    if (area && book.area !== area) return false;
    if (license && book.license !== license) return false;
    const haystack = normalize(`${book.title} ${book.author} ${book.synopsis} ${book.source}`);
    return terms.every((term) => haystack.includes(term));
  });

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
        {plural(lang, results.length, t.common.works)}
      </p>
      <div className="mt-4 grid gap-5 md:grid-cols-2">
        {results.map((book) => (
          <BookCard key={book.id} book={book} lang={lang} t={t} />
        ))}
      </div>
      {results.length === 0 && <p className="mt-8 text-xl text-ink-soft">{t.library.nothing}</p>}
    </>
  );
}
