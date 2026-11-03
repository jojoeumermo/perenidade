// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Linguagem simples verificada (Etapa 4, R1-88): um índice de facilidade de leitura para as aulas de entrada, calculado
// na montagem do site (nunca no aparelho de quem lê). Puro e sem os atalhos "@/": `npm run testar:aula-viva` roda este
// arquivo direto no Node, e scripts/legibilidade.mjs mede todas as aulas de entrada.
//
// A fórmula é a de Flesch (1948) com os números ajustados ao português:
//
//   índice = 248,835 − 1,015 × (palavras / frases) − 84,6 × (sílabas / palavras)
//
// Fonte: adaptação ao português citada em Martins et al. (1996), não conferida. A obra existe e está no repositório da
// USP (Martins, T. B. F.; Ghiraldelo, C. M.; Nunes, M. G. V.; Oliveira Jr., O. N. "Readability formulas applied to
// textbooks in Brazilian Portuguese". Notas do ICMSC-USP, Série Computação, n. 28. São Carlos, 1996), mas o arquivo de
// lá é uma digitalização sem texto e os números da fórmula e das faixas não puderam ser lidos nele; eles seguem o que
// trabalhos posteriores atribuem a esse estudo. Quem conferir no original, troque esta nota.
//
// Faixas: 75 a 100 muito fácil, 50 a 75 fácil, 25 a 50 difícil, 0 a 25 muito difícil. O índice é uma medida grosseira
// (conta tamanho de frase e de palavra, não sentido) e só serve para apontar aulas candidatas a uma versão fácil, que é
// escrita e revisada por educadores.

import { plainText } from "./text";

const VOGAIS = "aeiouáéíóúâêôãõàyü";
const vogal = (c: string | undefined) => Boolean(c) && c!.length === 1 && VOGAIS.includes(c!);

/**
 * Sílabas de uma palavra em português, por regra aproximada (divisão gramatical, a que se aprende na escola):
 * cada grupo de vogais é uma sílaba, menos os ditongos decrescentes (vogal + i/u sem acento: "lei", "au-la"), os nasais
 * ("pão", "mãe", "li-ções") e o u que só acompanha o q e o g ("quan-do", "á-gua", "guer-ra"). O i e o u tônicos com
 * acento formam hiato ("sa-ú-de", "pa-ís"), e também antes de nh e antes de l, m, n, r, z que fecham a sílaba
 * ("ra-i-nha", "a-in-da", "ca-ir", "ju-iz"). Palavra sem vogal (sigla, número) conta uma sílaba.
 */
export function contarSilabas(palavra: string): number {
  const p = palavra.toLowerCase().replace(/[^a-záéíóúâêôãõàçüyw]/g, "");
  if (!p) return /[\p{L}\p{N}]/u.test(palavra) ? 1 : 0;
  let silabas = 0;
  let anterior = "";
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (!vogal(c)) {
      anterior = c;
      continue;
    }
    // O u depois de q ou g, antes de outra vogal, é só som de apoio (ou mudo): não abre sílaba.
    if ((c === "u" || c === "ü") && (anterior === "q" || anterior === "g") && vogal(p[i + 1])) {
      anterior = "glide";
      continue;
    }
    if (vogal(anterior)) {
      // Nasal: ão, ãe, õe ficam numa sílaba só.
      if ((anterior === "ã" || anterior === "õ") && (c === "o" || c === "e")) {
        anterior = c;
        continue;
      }
      // Ditongo decrescente: vogal + i/u sem acento, salvo os casos de hiato.
      if ((c === "i" || c === "u") && !(anterior === c)) {
        const resto = p.slice(i + 1);
        const hiato = /^nh/.test(resto) || /^[lmnrz](?![aeiouáéíóúâêôãõ])/.test(resto);
        if (!hiato) {
          anterior = c;
          continue;
        }
      }
    }
    silabas++;
    anterior = c;
  }
  return Math.max(1, silabas);
}

/** As palavras de um texto (letras, com hífen e apóstrofo no meio; números contam como palavra). */
export function palavrasDe(texto: string): string[] {
  return texto.match(/[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu) ?? [];
}

/** Quantas frases: ponto final, de interrogação, de exclamação, reticências e fim de linha (título, item de lista). */
export function contarFrases(texto: string): number {
  return texto
    .split(/[.!?…]+(?=\s|$)|\n+/)
    .filter((f) => palavrasDe(f).length > 0).length;
}

export type Faixa = "muito-facil" | "facil" | "dificil" | "muito-dificil";

export interface Medida {
  indice: number;
  palavras: number;
  frases: number;
  silabas: number;
  palavrasPorFrase: number;
  silabasPorPalavra: number;
  faixa: Faixa;
}

export function faixaDe(indice: number): Faixa {
  if (indice >= 75) return "muito-facil";
  if (indice >= 50) return "facil";
  if (indice >= 25) return "dificil";
  return "muito-dificil";
}

/** O índice (0 a 100) de um texto corrido, com as contas que levaram a ele. Texto vazio dá null. */
export function medirLeitura(texto: string): Medida | null {
  const palavras = palavrasDe(texto);
  const frases = Math.max(1, contarFrases(texto));
  if (!palavras.length) return null;
  const silabas = palavras.reduce((s, p) => s + contarSilabas(p), 0);
  const palavrasPorFrase = palavras.length / frases;
  const silabasPorPalavra = silabas / palavras.length;
  const bruto = 248.835 - 1.015 * palavrasPorFrase - 84.6 * silabasPorPalavra;
  const indice = Math.round(Math.min(100, Math.max(0, bruto)) * 10) / 10;
  return { indice, palavras: palavras.length, frases, silabas, palavrasPorFrase: Math.round(palavrasPorFrase * 10) / 10, silabasPorPalavra: Math.round(silabasPorPalavra * 100) / 100, faixa: faixaDe(indice) };
}

/** Só o índice (0 a 100); texto vazio dá 0. */
export function indiceDeLeitura(texto: string): number {
  return medirLeitura(texto)?.indice ?? 0;
}

/**
 * O texto de uma aula em Markdown, pronto para medir: sem blocos de código e sem marcação, com cada linha (título, item
 * de lista, parágrafo) terminando a sua frase.
 */
export function textoParaMedir(markdown: string): string {
  return markdown
    .replace(/\r\n?/g, "\n")
    .replace(/```[\s\S]*?```/g, "\n")
    .replace(/\$\$[\s\S]*?\$\$/g, " ")
    .split("\n")
    .map((linha) => plainText(linha))
    .filter((linha) => palavrasDe(linha).length > 0)
    .join("\n");
}

/** As três palavras da aula: "fácil" (índice 50 ou mais), "média" (25 a 50) e "difícil" (abaixo de 25). */
export function nivelDaAula(indice: number): "facil" | "media" | "dificil" {
  return indice >= 50 ? "facil" : indice >= 25 ? "media" : "dificil";
}
