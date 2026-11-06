// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Texto na fronteira com o Fediverso. Para fora: o texto do post vira HTML simples e escapado (parágrafos, quebras e hashtags como
// link). Para dentro: o HTML de outra instância vira texto puro (sem marcação, sem imagem, sem script), antes de ser guardado ou
// mostrado. Lógica pura, sem "@/".

const ENTIDADES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };

/** Escapa para HTML. */
export function escaparHtml(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** O texto de um post em HTML: parágrafos por linha em branco, <br> por quebra simples e #tag como link para a página da tag. */
export function textoParaHtml(texto: string, linkDaTag: (tag: string) => string): string {
  return texto
    .trim()
    .split(/\n{2,}/)
    .map((paragrafo) => {
      const html = escaparHtml(paragrafo)
        .replace(/\n/g, "<br>")
        .replace(/(^|\s)#([\p{L}\p{N}_]{2,40})/gu, (_, antes: string, tag: string) => `${antes}<a href="${escaparHtml(linkDaTag(tag.toLowerCase()))}" class="mention hashtag" rel="tag">#<span>${tag}</span></a>`);
      return `<p>${html}</p>`;
    })
    .join("");
}

/** As hashtags do texto (minúsculas, sem repetir, até 10). */
export function hashtagsDe(texto: string): string[] {
  const vistas = new Set<string>();
  for (const m of texto.matchAll(/(^|\s)#([\p{L}\p{N}_]{2,40})/gu)) {
    vistas.add(m[2].toLowerCase());
    if (vistas.size >= 10) break;
  }
  return [...vistas];
}

/** HTML de fora vira texto puro: quebras e parágrafos viram linhas, o resto da marcação some, as entidades são decodificadas. */
export function htmlParaTexto(html: string, max = 3000): string {
  const semBlocos = html
    .slice(0, 50_000)
    .replace(/<(script|style|template|iframe|object|svg|math)[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|blockquote|h[1-6])\s*>/gi, "\n\n")
    .replace(/<[^>]*>/g, "");
  const decodificado = semBlocos.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z0-9]{2,8});/gi, (inteira, e: string) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 31 && n < 0x110000 && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : "";
    }
    return ENTIDADES[e.toLowerCase()] ?? inteira;
  });
  const limpo = decodificado
    // Caracteres de controle e de direção de texto (que servem para disfarçar link) saem.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‪-‮⁦-⁩]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return Array.from(limpo).slice(0, max).join("");
}

/** Um texto curto de fora (nome, @nome, aviso de conteúdo): uma linha, sem marcação. */
export function textoCurto(valor: unknown, max = 200): string {
  if (typeof valor !== "string") return "";
  return htmlParaTexto(valor, max).replace(/\s+/g, " ").trim();
}
