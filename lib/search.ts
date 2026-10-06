import { normalize } from "./text";

export interface SearchEntry {
  kind: "aula" | "obra" | "trilha";
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

export function search(entries: SearchEntry[], query: string, limit = 40): SearchHit[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];

  const scored: { hit: SearchHit; score: number }[] = [];
  for (const entry of entries) {
    const title = normalize(entry.title);
    const context = normalize(entry.context);
    const body = normalize(entry.text);
    let score = 0;
    let matched = true;
    for (const term of terms) {
      if (title.includes(term)) score += 10;
      else if (context.includes(term)) score += 4;
      else if (body.includes(term)) score += 1;
      else {
        matched = false;
        break;
      }
    }
    if (!matched) continue;

    // normalize() preserva o comprimento na prática (só remove acentos combinados),
    // então o índice no texto normalizado serve de aproximação para o trecho original.
    const at = body.indexOf(terms[0]);
    const start = Math.max(0, at - 60);
    const snippet =
      at < 0
        ? entry.text.slice(0, 160)
        : (start > 0 ? "…" : "") + entry.text.slice(start, start + 180).trim() + "…";
    scored.push({ hit: { entry, snippet }, score });
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.hit);
}
