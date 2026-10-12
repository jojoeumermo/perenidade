// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
/** Minúsculas e sem acentos, para busca e comparação. */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function slugify(text: string): string {
  return normalize(text)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Remove a marcação Markdown, deixando só o texto corrido. */
export function plainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[`*_>#|]/g, " ")
    .replace(/^\s*[-:]+\s*$/gm, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Endereço que pode virar link: https ou um caminho do próprio site. O banco já confere isso na entrada;
 * o navegador confere de novo, para um endereço adulterado no banco nunca virar "javascript:" em um clique.
 */
export const safeLink = (url: string): boolean => /^https:\/\/\S+$/.test(url) || /^\/(?!\/)\S*$/.test(url);

export function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}
