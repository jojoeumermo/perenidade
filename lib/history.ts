// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { execFileSync } from "node:child_process";
import { cache } from "react";

export interface Change {
  hash: string;
  date: string;
  author: string;
  subject: string;
  files: string[];
}

// O histórico do acervo é o próprio histórico do Git, lido na hora do build.
// Em clones rasos (ex.: Vercel sem VERCEL_DEEP_CLONE=true) só aparecem os commits mais recentes.
export const getHistory = cache((): Change[] => {
  try {
    const out = execFileSync(
      "git",
      [
        "-c",
        "core.quotepath=off",
        "log",
        "-n",
        "300",
        "--date=short",
        "--name-only",
        "--pretty=format:%x1e%h%x1f%ad%x1f%an%x1f%s",
        "--",
        "content",
      ],
      { encoding: "utf8", cwd: process.cwd(), stdio: ["ignore", "pipe", "ignore"] },
    );
    return out
      .split("\x1e")
      .filter(Boolean)
      .map((entry) => {
        const [head, ...files] = entry.split("\n");
        const [hash, date, author, subject] = head.split("\x1f");
        return { hash, date, author, subject, files: files.map((f) => f.trim()).filter(Boolean) };
      });
  } catch {
    return [];
  }
});

export function fileHistory(file: string): { updated?: string; revisions: number } {
  const changes = getHistory().filter((c) => c.files.includes(file));
  return { updated: changes[0]?.date, revisions: changes.length };
}
