// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// "Baixar para o WhatsApp" (Etapa 3, B17): a aula vira um .html único, sem nada de fora (sem script, sem fonte, sem
// imagem remota), que abre sem internet num celular antigo e cabe numa mensagem (menos de 1 MB). Aqui fica só a parte
// pura (montar o documento e conferir o tamanho); o recorte da página é feito no navegador (components/BaixarArquivoUnico.tsx).
// Sem os atalhos "@/" de propósito: os roteiros de conferência rodam este arquivo direto no Node.

export const LIMITE_DO_ARQUIVO = 1024 * 1024;

const ESTILO =
  "body{margin:0;background:#f8f5ee;color:#1f1a14;font:18px/1.6 Georgia,serif}main{max-width:40rem;margin:0 auto;padding:1.25rem}" +
  "h1{font-size:1.9rem;line-height:1.15}h2{font-size:1.35rem;margin-top:2rem;border-bottom:2px solid #1f1a14}h3{font-size:1.15rem}" +
  "a{color:#6e1f1a}img,svg{max-width:100%;height:auto}table{border-collapse:collapse;width:100%}td,th{border:1px solid #bbb;padding:.3rem}" +
  "aside,.bloco{border-left:4px solid #6e1f1a;background:#fff;padding:.75rem 1rem;margin:1rem 0}pre{white-space:pre-wrap}" +
  "footer{margin-top:2.5rem;border-top:1px solid #bbb;padding-top:.75rem;font:14px/1.5 sans-serif;color:#5a4e3c}" +
  "@media(prefers-color-scheme:dark){body{background:#17130e;color:#efe4c8}aside,.bloco{background:#221c15}a{color:#e0837a}h2{border-color:#efe4c8}}";

const escapar = (texto: string) => texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Tira de um pedaço de HTML o que não funciona (ou não deve ir) num arquivo solto: scripts, eventos e endereços javascript:. */
export function limparHtml(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<(iframe|object|embed|video|audio|link|style|noscript)\b[\s\S]*?(<\/\1>|\/?>)/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, "");
}

/** O documento inteiro: título, conteúdo já recortado, rodapé com a fonte e o aviso de que os testes ficam no site. */
export function montarArquivoUnico({ titulo, conteudo, url, lang, fonte, rodape }: { titulo: string; conteudo: string; url: string; lang: string; fonte: string; rodape: string }): string {
  return (
    `<!doctype html><html lang="${escapar(lang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>${escapar(titulo)} — Instituto Lúcia</title><style>${ESTILO}</style></head><body><main>${limparHtml(conteudo)}` +
    `<footer><p>${escapar(rodape)}</p><p>${escapar(fonte)} <a href="${escapar(url)}">${escapar(url)}</a> · Instituto Lúcia</p></footer></main></body></html>`
  );
}

/** Tamanho em bytes do texto em UTF-8. */
export const tamanhoEmBytes = (texto: string) => new TextEncoder().encode(texto).length;

/** Nome do arquivo a partir do endereço da aula: "trilha-aula.html". */
export function nomeDoArquivo(caminho: string): string {
  const partes = caminho.split(/[?#]/)[0].split("/").filter(Boolean).filter((p) => !/^(pt|en|es|fr|ru|zh|trilhas)$/.test(p));
  return `${(partes.join("-") || "aula").replace(/[^a-z0-9-]/gi, "").slice(0, 80) || "aula"}.html`;
}
