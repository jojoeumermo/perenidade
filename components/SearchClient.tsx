// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { fill, localePath, plural } from "@/i18n/config";
import { buildSearch, type SearchEntry } from "@/lib/search";
import { L, useI18n } from "./I18n";

export function SearchClient() {
  const { lang, t } = useI18n();
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [entries, setEntries] = useState<SearchEntry[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(localePath(lang, "/indice.json"))
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<SearchEntry[]>;
      })
      .then((data) => {
        if (!cancelled) setEntries(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [lang]);

  const search = useMemo(() => (entries ? buildSearch(entries) : null), [entries]);
  const hits = search ? search(query) : [];
  const typed = query.trim().length > 0;
  const kinds = t.search.kinds as Record<string, string>;

  return (
    <>
      <div role="search" className="mt-8 flex border-2 border-ink bg-parchment-deep">
        <input
          type="search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={t.search.label}
          placeholder={t.search.placeholder}
          className="min-w-0 flex-1 bg-transparent px-4 py-3 font-mono text-sm outline-none placeholder:text-ink-soft"
        />
      </div>

      <p role="status" className="mt-6 font-mono text-xs text-ink-soft">
        {failed
          ? t.search.failed
          : !entries
            ? t.search.loading
            : typed
              ? plural(lang, hits.length, t.search.results)
              : fill(t.search.indexSize, { n: entries.length })}
      </p>

      <ul className="mt-4 divide-y divide-rule border-y border-rule">
        {hits.map(({ entry, snippet }) => (
          <li key={entry.href}>
            <L href={entry.href} className="group block py-5">
              <p className="font-mono text-xs text-gold">{[kinds[entry.kind], entry.area, entry.context].filter(Boolean).join(" · ")}</p>
              <p className="mt-1 text-2xl font-semibold group-hover:text-oxblood">{entry.title}</p>
              <p className="mt-1 text-ink-soft">{snippet}</p>
            </L>
          </li>
        ))}
      </ul>
      {entries && typed && hits.length === 0 && (
        <p className="mt-8 text-xl text-ink-soft">
          {fill(t.search.nothingFor, { q: query.trim() })}{" "}
          <L href="/contribuir" className="underline hover:text-oxblood">{t.search.canContribute}</L>.
        </p>
      )}
    </>
  );
}
