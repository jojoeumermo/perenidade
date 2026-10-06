"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { search, type SearchEntry } from "@/lib/search";

const labels = { aula: "Aula", obra: "Obra", trilha: "Trilha" } as const;

export function SearchClient() {
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [entries, setEntries] = useState<SearchEntry[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/indice.json")
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
  }, []);

  const hits = entries ? search(entries, query) : [];
  const typed = query.trim().length > 0;

  return (
    <>
      <div role="search" className="mt-8 flex border-2 border-ink bg-parchment-deep">
        <input
          type="search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Buscar em aulas, trilhas e obras"
          placeholder="Ex.: algoritmo, Machado, verbo to be…"
          className="min-w-0 flex-1 bg-transparent px-4 py-3 font-mono text-sm outline-none placeholder:text-ink-soft"
        />
      </div>

      <p role="status" className="mt-6 font-mono text-xs text-ink-soft">
        {failed
          ? "Não foi possível carregar o índice de busca. Recarregue a página para tentar de novo."
          : !entries
            ? "Carregando o índice…"
            : typed
              ? `${hits.length} ${hits.length === 1 ? "resultado" : "resultados"}`
              : `${entries.length} itens no índice. Digite para buscar.`}
      </p>

      <ul className="mt-4 divide-y divide-rule border-y border-rule">
        {hits.map(({ entry, snippet }) => (
          <li key={entry.href}>
            <Link href={entry.href} className="group block py-5">
              <p className="font-mono text-xs text-gold">
                {labels[entry.kind]} · {entry.area} · {entry.context}
              </p>
              <p className="mt-1 text-2xl font-semibold group-hover:text-oxblood">{entry.title}</p>
              <p className="mt-1 text-ink-soft">{snippet}</p>
            </Link>
          </li>
        ))}
      </ul>
      {entries && typed && hits.length === 0 && (
        <p className="mt-8 text-xl text-ink-soft">
          Nada encontrado para “{query.trim()}”. Se esse assunto faz falta,{" "}
          <Link href="/contribuir" className="underline hover:text-oxblood">você pode contribuir com ele</Link>.
        </p>
      )}
    </>
  );
}
