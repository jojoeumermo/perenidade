"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { areas, licenses } from "@/lib/areas";
import type { Book } from "@/lib/content";
import { normalize } from "@/lib/text";
import { BookCard } from "./Cards";

const field = "border-2 border-ink bg-parchment-deep px-3 py-2";

export function AcervoBrowser({ books }: { books: Book[] }) {
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
          aria-label="Buscar por título ou autor"
          placeholder="Título, autor…"
          className={`${field} min-w-60 flex-1 font-mono outline-none`}
        />
        <select value={area} onChange={(e) => setArea(e.target.value)} aria-label="Área" className={field}>
          <option value="">Todas as áreas</option>
          {areas.map((a) => (
            <option key={a.slug} value={a.slug}>
              {a.name}
            </option>
          ))}
        </select>
        <select value={license} onChange={(e) => setLicense(e.target.value)} aria-label="Licença" className={field}>
          <option value="">Todas as licenças</option>
          {licenses.map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
      </div>

      <p role="status" className="mt-6 font-mono text-xs text-ink-soft">
        {results.length} {results.length === 1 ? "obra" : "obras"}
      </p>
      <div className="mt-4 grid gap-5 md:grid-cols-2">
        {results.map((book) => (
          <BookCard key={book.id} book={book} />
        ))}
      </div>
      {results.length === 0 && <p className="mt-8 text-xl text-ink-soft">Nada encontrado. Tente outro termo ou remova um filtro.</p>}
    </>
  );
}
