// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Leitura de campos do cabeçalho (frontmatter) dos arquivos de content/: funções puras, sem disco e sem caminho. Moradas
// compartilhadas por lib/content.ts e pelos leitores enxutos (ex.: lib/jornal/leitura-do-app.ts), de propósito sem
// "fs" nem process.cwd(): quem importa este módulo não leva content/ inteiro no rastreio das funções do build.
import { plainText } from "./text";
import type { Source } from "./content";

export type Data = Record<string, unknown>;

export function fail(file: string, message: string): never {
  throw new Error(`Conteúdo inválido em ${file}: ${message}`);
}

export function text(data: Data, key: string, file: string): string {
  const value = data[key];
  if (typeof value !== "string" || !value.trim()) fail(file, `o campo "${key}" é obrigatório`);
  return value.trim();
}

export function optional(data: Data, key: string): string | undefined {
  const value = data[key];
  return value === undefined || value === null ? undefined : String(value).trim();
}

export function dateOf(data: Data, key: string, file: string): string {
  const raw = data[key];
  const value = raw instanceof Date ? raw.toISOString().slice(0, 10) : String(raw ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) fail(file, `"${key}" deve ser uma data no formato AAAA-MM-DD`);
  return value;
}

/** Fontes: lista de { titulo, autor, url, ano }. Todo material de ensino precisa de ao menos uma. */
export function parseSources(raw: unknown, file: string, required: boolean): Source[] {
  if (raw === undefined || raw === null) {
    if (required) fail(file, `falta o campo "fontes": todo material precisa citar ao menos uma fonte`);
    return [];
  }
  if (!Array.isArray(raw)) fail(file, `"fontes" deve ser uma lista`);
  const sources = raw.map((item: Data | string, i) => {
    if (typeof item === "string") return { title: item };
    const url = optional(item, "url");
    if (url && !/^https?:\/\/\S+$/.test(url)) fail(file, `fontes[${i}]: o endereço deve começar com http:// ou https://`);
    return { title: text(item, "titulo", file), author: optional(item, "autor"), url, year: optional(item, "ano") };
  });
  if (required && sources.length === 0) fail(file, `"fontes" precisa de ao menos um item`);
  return sources;
}


export function slugOf(name: string, file: string): string {
  if (!/^[a-z0-9-]+\.md$/.test(name)) fail(file, "use apenas letras minúsculas, números e hífens no nome do arquivo");
  return name.replace(/\.md$/, "");
}

export const minutesOf = (body: string) => Math.max(1, Math.ceil(plainText(body).split(" ").length / 180));

// ativo: false tira o item do ar sem apagar o histórico (quarentena de denúncias).
export const isActive = (data: Data) => data.ativo !== false;

/**
 * O arquivo é um original (aula, verbete, matéria)? Fora as traduções ("x.en.md") e as versões fáceis das aulas
 * ("x.facil.md", e as traduções delas, "x.facil.en.md"), que moram ao lado do original e nunca viram item nem idioma.
 */
export const eOriginal = (name: string) => name.endsWith(".md") && !/\.[a-z]{2}\.md$/.test(name) && !/\.facil(\.[a-z]{2})?\.md$/.test(name);
