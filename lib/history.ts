// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { cache } from "react";

export interface Change {
  date: string;
  files: string[];
}

// O histórico do acervo é o próprio histórico do Git, lido na hora do build. Só a data e os arquivos de content/:
// a mensagem e o autor de cada registro são da equipe e nem chegam a ser lidos.
// Em clones rasos (como o da Vercel) só aparecem os commits mais recentes, e o mais antigo deles, a "fronteira", aparece
// como se tivesse criado todos os arquivos de uma vez. Ele fica de fora, para o histórico não dizer que o acervo inteiro
// nasceu naquele dia. O código de cada registro só é lido para achar a fronteira e não sai daqui.
export const getHistory = cache((): Change[] => {
  try {
    const git = (args: string[]) => execFileSync("git", args, { encoding: "utf8", cwd: process.cwd(), stdio: ["ignore", "pipe", "ignore"] });
    let fronteira = new Set<string>();
    try {
      const arquivo = git(["rev-parse", "--git-path", "shallow"]).trim();
      if (existsSync(arquivo)) fronteira = new Set(readFileSync(arquivo, "utf8").split(/\s+/).filter(Boolean));
    } catch {
      // sem essa informação, nada é descartado
    }
    const out = git(["-c", "core.quotepath=off", "log", "-n", "300", "--no-merges", "--date=short", "--name-only", "--pretty=format:%x1e%H %ad", "--", "content"]);
    return out
      .split("\x1e")
      .filter(Boolean)
      .map((entry) => {
        const [cabeca, ...files] = entry.split("\n");
        const [codigo, date] = cabeca.trim().split(" ");
        return { codigo, date, files: files.map((f) => f.trim()).filter(Boolean) };
      })
      .filter((change) => !fronteira.has(change.codigo))
      .map(({ date, files }) => ({ date, files }));
  } catch {
    return [];
  }
});

/** Os tipos de conteúdo que o histórico público conta, na ordem em que aparecem. */
export const kinds = ["lessons", "tracks", "translations", "books", "catalog", "journal", "glossary", "memorial", "authors", "checks", "debates", "videos", "pages", "other"] as const;
export type Kind = (typeof kinds)[number];

const folders: Record<string, Kind> = {
  acervo: "books",
  catalogo: "catalog",
  jornal: "journal",
  glossario: "glossary",
  memorial: "memorial",
  autores: "authors",
  checagens: "checks",
  debates: "debates",
  videos: "videos",
  paginas: "pages",
};

/** "content/trilhas/x/01-aula.md" é uma aula; "content/acervo/obra.en.md", uma tradução. */
function kindOf(file: string): Kind {
  const folder = file.split("/")[1] ?? "";
  if (/\.(en|es|zh|ru)\.md$/.test(file)) return "translations";
  if (folder === "trilhas") return /\/(_trilha\.md|plano\.json)$/.test(file) ? "tracks" : "lessons";
  return folders[folder] ?? "other";
}

export interface PublicChange {
  date: string;
  /** Quantos itens de cada tipo mudaram nesse dia. */
  counts: [Kind, number][];
  files: string[];
}

/**
 * O que a página de histórico e a página inicial mostram, a partir da data dada: um dia por linha, com o tipo de
 * conteúdo que mudou e quantos itens. Nada do funcionamento interno do site entra aqui.
 */
export function publicHistory(from: string): PublicChange[] {
  if (!from) return [];
  const days = new Map<string, Set<string>>();
  for (const change of getHistory()) {
    if (change.date < from || change.files.length === 0) continue;
    const day = days.get(change.date) ?? new Set<string>();
    for (const file of change.files) day.add(file);
    days.set(change.date, day);
  }
  return [...days]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, set]) => {
      const files = [...set].sort();
      const counts = new Map<Kind, number>();
      for (const file of files) counts.set(kindOf(file), (counts.get(kindOf(file)) ?? 0) + 1);
      return { date, files, counts: kinds.filter((kind) => counts.has(kind)).map((kind): [Kind, number] => [kind, counts.get(kind) ?? 0]) };
    });
}

export function fileHistory(file: string): { updated?: string; revisions: number } {
  const changes = getHistory().filter((c) => c.files.includes(file));
  return { updated: changes[0]?.date, revisions: changes.length };
}
