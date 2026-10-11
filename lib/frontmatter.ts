// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import yaml from "js-yaml";

/**
 * Separa o cabeçalho (entre duas linhas "---") do texto de um arquivo de conteúdo.
 * O cabeçalho é lido como dados simples: texto, números, datas e listas. Nada nele é executado.
 */
export function parseFrontmatter(raw: string): { data: Record<string, unknown>; content: string } {
  const text = raw.replace(/^﻿/, "");
  const match = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
  if (!match) return { data: {}, content: text };
  const data = yaml.load(match[1]);
  const isRecord = data !== null && typeof data === "object" && !Array.isArray(data);
  return { data: isRecord ? (data as Record<string, unknown>) : {}, content: text.slice(match[0].length) };
}
