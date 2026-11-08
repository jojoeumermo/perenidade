// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As figuras das provas públicas (por enquanto só o Enem, transcrito pela enem.dev). O importador
// (scripts/importar-questoes.mjs) grava cada figura como um link em Markdown: "[🖼 imagem da questão](https://enem.dev/…png)"
// no texto da questão e "[🖼 imagem da alternativa](https://enem.dev/…png)" na alternativa. Aqui esse link vira figura
// na página. Só endereços do formato da enem.dev, com extensão de imagem, viram figura (a política de segurança do site
// só deixa o navegador buscar imagens dali: img-src em next.config.ts). O resto continua como estava.

/** Os únicos lugares de fora de onde o site mostra figuras de prova (precisam estar no img-src de next.config.ts). */
export const ORIGENS_DAS_FIGURAS = ["https://enem.dev"] as const;

const ENDERECO = /^https:\/\/enem\.dev\/\d{4}\/questions\/[A-Za-z0-9-]{1,40}\/[A-Za-z0-9-]{1,80}\.(?:png|jpe?g|gif|webp|bmp)$/i;

/** O endereço é de uma figura de prova que o site pode mostrar? */
export function eFiguraDaProva(url: string): boolean {
  return ENDERECO.test(url);
}

const MARCA = /\[🖼 imagem da (questão|alternativa)\]\(([^)\s]+)\)/gu;

export type ParteDoTexto = { tipo: "texto"; texto: string } | { tipo: "figura"; src: string };

/**
 * Separa um texto simples (uma alternativa) em pedaços de texto e figuras. Uma marca com endereço que não é de figura
 * (a fonte às vezes aponta para um arquivo .latex) fica como texto, igual à fonte.
 */
export function partesDoTexto(texto: string): ParteDoTexto[] {
  const partes: ParteDoTexto[] = [];
  let desde = 0;
  const juntarTexto = (t: string) => {
    if (!t) return;
    const ultima = partes[partes.length - 1];
    if (ultima?.tipo === "texto") ultima.texto += t;
    else partes.push({ tipo: "texto", texto: t });
  };
  for (const m of texto.matchAll(MARCA)) {
    const inicio = m.index ?? 0;
    juntarTexto(texto.slice(desde, inicio));
    if (eFiguraDaProva(m[2])) partes.push({ tipo: "figura", src: m[2] });
    else juntarTexto(m[0]);
    desde = inicio + m[0].length;
  }
  juntarTexto(texto.slice(desde));
  return partes.flatMap((p): ParteDoTexto[] => {
    if (p.tipo === "figura") return [p];
    const texto = p.texto.replace(/\s+/g, " ");
    return texto.trim() ? [{ tipo: "texto", texto }] : [];
  });
}

/** O texto sem as marcas de figura, para busca e para guardar como texto puro (a figura vira "🖼"). */
export function semFiguras(texto: string): string {
  return texto.replace(MARCA, "🖼").replace(/\s+/g, " ").trim();
}

/**
 * As figuras da lista "imagens" da questão que não aparecem em nenhum dos textos (a fonte às vezes lista uma figura
 * sem pôr a marca no texto). Elas entram na página logo depois do texto da questão.
 */
export function figurasSoltas(imagens: readonly string[], ...textos: readonly string[]): string[] {
  const tudo = textos.join("\n");
  return [...new Set(imagens)].filter((url) => eFiguraDaProva(url) && !tudo.includes(url));
}
