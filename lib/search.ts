// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import MiniSearch from "minisearch";
import { normalize } from "./text";

export interface SearchEntry {
  kind: "aula" | "obra" | "trilha" | "autor" | "memorial" | "verbete" | "materia" | "checagem" | "debate" | "falacia" | "pergunta";
  title: string;
  href: string;
  area: string;
  context: string;
  text: string;
  /** Outros nomes pelos quais o item pode ser procurado (a disciplina nos outros idiomas, por exemplo). Não aparece na tela. */
  also?: string;
}

export interface SearchHit {
  entry: SearchEntry;
  snippet: string;
}

/**
 * Monta o motor de busca no navegador: tolera erro de digitação, ignora acentos e maiúsculas,
 * completa palavras pela metade e dá mais peso ao título do que ao corpo do texto.
 */
export function buildSearch(entries: SearchEntry[], synonyms: Record<string, string> = {}) {
  // "simple present" vira "presente simples": quem procura no próprio idioma chega à aula escrita em português.
  const known = Object.entries(synonyms)
    .map(([from, to]) => [normalize(from), normalize(to)] as const)
    .sort((a, b) => b[0].length - a[0].length);
  const translate = (query: string) => {
    let text = ` ${normalize(query)} `;
    for (const [from, to] of known) text = text.split(` ${from} `).join(` ${to} `);
    return text.trim();
  };
  const engine = new MiniSearch<SearchEntry & { id: number }>({
    fields: ["title", "context", "area", "also", "text"],
    processTerm: (term) => normalize(term),
    searchOptions: {
      boost: { title: 6, context: 2.5, area: 1.5, also: 3 },
      prefix: true,
      fuzzy: (term) => (term.length > 4 ? 0.2 : false),
      combineWith: "AND",
    },
  });
  engine.addAll(entries.map((entry, id) => ({ ...entry, id })));

  return (query: string, limit = 50): SearchHit[] => {
    const clean = query.trim();
    if (!clean) return [];
    const translated = translate(clean);
    let found = engine.search(clean);
    // O mesmo pedido, com os termos de outro idioma trocados pelos do site: junta os dois resultados.
    if (translated && translated !== normalize(clean)) {
      const seen = new Set(found.map((result) => result.id as number));
      found = [...found, ...engine.search(translated).filter((result) => !seen.has(result.id as number))].sort((a, b) => b.score - a.score);
    }
    // Nada com todas as palavras? Aceita resultados com parte delas, em vez de devolver vazio.
    if (found.length === 0) found = engine.search(translated || clean, { combineWith: "OR" });
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
