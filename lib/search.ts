// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import MiniSearch from "minisearch";
import { normalize } from "./text";

export interface SearchEntry {
  kind: "aula" | "obra" | "trilha" | "autor" | "memorial" | "verbete" | "materia" | "checagem" | "debate" | "pergunta";
  title: string;
  href: string;
  area: string;
  context: string;
  text: string;
}

export interface SearchHit {
  entry: SearchEntry;
  snippet: string;
}

/**
 * Monta o motor de busca no navegador: tolera erro de digitação, ignora acentos e maiúsculas,
 * completa palavras pela metade e dá mais peso ao título do que ao corpo do texto.
 */
export function buildSearch(entries: SearchEntry[]) {
  const engine = new MiniSearch<SearchEntry & { id: number }>({
    fields: ["title", "context", "area", "text"],
    processTerm: (term) => normalize(term),
    searchOptions: {
      boost: { title: 6, context: 2.5, area: 1.5 },
      prefix: true,
      fuzzy: (term) => (term.length > 4 ? 0.2 : false),
      combineWith: "AND",
    },
  });
  engine.addAll(entries.map((entry, id) => ({ ...entry, id })));

  return (query: string, limit = 50): SearchHit[] => {
    const clean = query.trim();
    if (!clean) return [];
    let found = engine.search(clean);
    // Nada com todas as palavras? Aceita resultados com parte delas, em vez de devolver vazio.
    if (found.length === 0) found = engine.search(clean, { combineWith: "OR" });
    const first = normalize(clean).split(/\s+/)[0];
    return found.slice(0, limit).map((result) => {
      const entry = entries[result.id as number];
      const at = normalize(entry.text).indexOf(first);
      const start = Math.max(0, at - 60);
      const snippet = at < 0 ? entry.text.slice(0, 170) : (start > 0 ? "…" : "") + entry.text.slice(start, start + 190).trim() + "…";
      return { entry, snippet };
    });
  };
}
