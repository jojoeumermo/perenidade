// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A base dos jogos de treino (página /jogos): o verbete do glossário que alimenta os jogos, o sorteio com semente (para o
// teste conferir) e as funções de texto. Sem "@/" de propósito: `npm run testar:jogos-pagina` roda este arquivo no Node.

/** Um verbete do glossário, do jeito que os jogos usam. A aula é onde o termo aparece, quando há uma. */
export interface Verbete {
  termo: string;
  resumo: string;
  aula?: { titulo: string; href: string };
}

/** Sorteio com semente (mulberry32): a mesma semente dá o mesmo jogo, o que deixa o teste estável. */
export function criarSorteio(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Sorteio = () => number;

export const sementeNova = () => Math.floor(Math.random() * 2 ** 31);

/** Embaralha uma cópia (Fisher-Yates). */
export function embaralhar<T>(lista: readonly T[], rnd: Sorteio): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

export const sortear = <T,>(lista: readonly T[], n: number, rnd: Sorteio): T[] => embaralhar(lista, rnd).slice(0, n);

/** Sem acentos e em maiúsculas. */
export const semAcento = (texto: string): string => texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

/** Só as letras A-Z, sem acento (a forma da palavra nos jogos de grade). */
export const soLetras = (texto: string): string => semAcento(texto).replace(/[^A-Z]/g, "");

/** O termo é uma palavra só, escrita só com letras (com ou sem acento)? */
export const ehPalavraSimples = (termo: string): boolean => /^[\p{L}]+$/u.test(termo.trim());

export interface PalavraDeJogo {
  /** A palavra em A-Z, sem acento. */
  palavra: string;
  /** O termo como está no glossário. */
  termo: string;
  resumo: string;
  aula?: { titulo: string; href: string };
}

/** As palavras do glossário que servem aos jogos de letras: uma palavra só, com tamanho entre min e max, sem repetir. */
export function palavrasParaLetras(verbetes: readonly Verbete[], min = 4, max = 12): PalavraDeJogo[] {
  const vistas = new Set<string>();
  const saida: PalavraDeJogo[] = [];
  for (const v of verbetes) {
    if (!ehPalavraSimples(v.termo)) continue;
    const palavra = soLetras(v.termo);
    if (palavra.length < min || palavra.length > max || vistas.has(palavra)) continue;
    vistas.add(palavra);
    saida.push({ palavra, termo: v.termo.trim(), resumo: v.resumo, aula: v.aula });
  }
  return saida;
}

/** Troca no texto as palavras que começam como o termo por "____", para a dica não entregar a resposta. */
export function mascarar(resumo: string, termo: string): string {
  const alvo = soLetras(termo);
  if (alvo.length < 3) return resumo;
  const prefixo = alvo.slice(0, Math.max(3, alvo.length - 2));
  return resumo.replace(/[\p{L}]+/gu, (palavra) => (soLetras(palavra).startsWith(prefixo) ? "____" : palavra));
}

/** A primeira frase do resumo (até o primeiro ponto final seguido de espaço), cortada em `max` letras se for longa. */
export function primeiraFrase(resumo: string, max = 160): string {
  const texto = resumo.replace(/\s+/g, " ").trim();
  const fim = texto.search(/[.!?](\s|$)/);
  const frase = fim >= 0 ? texto.slice(0, fim + 1) : texto;
  if (frase.length <= max) return frase;
  const corte = frase.slice(0, max);
  return `${corte.slice(0, Math.max(corte.lastIndexOf(" "), 20))}…`;
}

/** Compara o que a pessoa escreveu com o certo: "certo", "acento" (letras certas, acento ou cedilha diferente) ou "errado". */
export function compararDitado(resposta: string, certa: string): "certo" | "acento" | "errado" {
  const limpar = (s: string) => s.normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();
  const a = limpar(resposta);
  const b = limpar(certa);
  if (a === b) return "certo";
  const semSinais = (s: string) => semAcento(s).replace(/[^A-Z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  return semSinais(a) === semSinais(b) && semSinais(b) !== "" ? "acento" : "errado";
}
