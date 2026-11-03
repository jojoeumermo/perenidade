// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Conferir uma resposta DIGITADA perdoando o erro de digitação (Etapa 4, pacote E4-13, ideia R1-26; docs/escola/avaliacao.md).
// Puro: sem React, sem armazenamento e sem os atalhos "@/" (`npm run testar:escola-avaliacao` roda este arquivo no Node).
//
// A regra:
// - Normaliza dos dois lados: minúsculas, pontuação e símbolos viram espaço, espaços repetidos e nas pontas saem.
// - Acento: por padrão não conta ("voce" vale "você"). Com { acento: "quase" } (as línguas estrangeiras), a resposta
//   sem o acento é aceita como QUASE, com a grafia certa ao lado.
// - Palavra por palavra, aceita a distância de Damerau–Levenshtein (troca, falta, sobra ou inversão de duas letras
//   vizinhas) de 1 para palavras de 5 a 8 letras e de 2 para palavras de 9 letras ou mais. Nunca para números nem para
//   palavras de até 4 letras (aí uma letra muda a palavra: "mar" e "mau"), nem para escrita sem alfabeto (chinês, japonês).
// - Devolve { certo, quase, grafia }: `certo` é "aceita"; `quase` diz que só foi aceita pelo perdão (acento ou
//   digitação), e então `grafia` traz a forma certa para mostrar "Quase! A grafia é X".
// Os exercícios numéricos não passam por aqui: já aceitam 3/4 e 0,75 (lib/exercicios.ts e lib/interativos.ts).

export interface OpcoesDoConfere {
  /** "ignora" (padrão): o acento não conta. "quase": sem o acento é aceita como quase (línguas estrangeiras). */
  acento?: "ignora" | "quase";
  /** false desliga o perdão da digitação (fica só a comparação sem maiúsculas, pontuação e, se "ignora", acento). */
  tolerante?: boolean;
}

export interface Conferido {
  /** A resposta foi aceita (exata ou quase). */
  certo: boolean;
  /** Aceita só pelo perdão (acento ou digitação). */
  quase: boolean;
  /** A grafia certa, quando é quase; null quando é exata ou errada. */
  grafia: string | null;
}

/** Minúsculas, pontuação e símbolos viram espaço, sem espaços repetidos nem nas pontas. Com `semAcento`, tira os acentos. */
export function normalizarResposta(texto: string, semAcento = true): string {
  const base = String(texto ?? "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return semAcento ? base.normalize("NFD").replace(/\p{M}/gu, "").normalize("NFC") : base;
}

/**
 * Distância de Damerau–Levenshtein na forma "alinhamento ótimo" (cada trecho só é editado uma vez): quantas letras
 * trocar, tirar, pôr ou inverter com a vizinha para uma palavra virar a outra. Conta por caractere (não por byte).
 */
export function distancia(a: string, b: string): number {
  const x = [...a];
  const y = [...b];
  const m = x.length;
  const n = y.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const custo = x[i - 1] === y[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + custo);
      if (i > 1 && j > 1 && x[i - 1] === y[j - 2] && x[i - 2] === y[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[m][n];
}

/** Escritas sem alfabeto: um caractere a mais ou a menos já é outra palavra. */
const SEM_ALFABETO = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

/** Quantas letras de diferença a palavra esperada aceita: 0 (até 4 letras, número ou ideograma), 1 (5 a 8) ou 2 (9 ou mais). */
export function tolerancia(palavra: string): 0 | 1 | 2 {
  if (/\p{N}/u.test(palavra) || SEM_ALFABETO.test(palavra)) return 0;
  const n = [...palavra].length;
  return n >= 9 ? 2 : n >= 5 ? 1 : 0;
}

/** Cada palavra da resposta bate com a esperada, dentro da tolerância de cada uma? (O número de palavras tem de ser igual.) */
function pertoPorPalavra(dada: string, esperada: string): boolean {
  const a = dada.split(" ").filter(Boolean);
  const e = esperada.split(" ").filter(Boolean);
  if (a.length !== e.length || e.length === 0) return false;
  return e.every((palavra, i) => palavra === a[i] || distancia(a[i], palavra) <= tolerancia(palavra));
}

const ERRADA: Conferido = { certo: false, quase: false, grafia: null };

/** Confere a resposta digitada contra uma ou mais respostas aceitas. */
export function confere(dada: string, esperadas: string | readonly string[], opcoes: OpcoesDoConfere = {}): Conferido {
  const lista = (Array.isArray(esperadas) ? esperadas : [esperadas as string]).filter((e) => typeof e === "string" && normalizarResposta(e) !== "");
  const acento = opcoes.acento ?? "ignora";
  const tolerante = opcoes.tolerante !== false;
  const comAcento = normalizarResposta(dada, false);
  const semAcento = normalizarResposta(dada, true);
  if (!semAcento || lista.length === 0) return ERRADA;
  // 1º: exata (com os acentos; ou sem eles, quando o acento não conta).
  for (const e of lista) {
    if (normalizarResposta(e, false) === comAcento) return { certo: true, quase: false, grafia: null };
    if (acento === "ignora" && normalizarResposta(e, true) === semAcento) return { certo: true, quase: false, grafia: null };
  }
  // 2º: só o acento difere (línguas estrangeiras): quase.
  if (acento === "quase") for (const e of lista) if (normalizarResposta(e, true) === semAcento) return { certo: true, quase: true, grafia: e.trim() };
  // 3º: erro de digitação dentro da tolerância de cada palavra: quase.
  if (tolerante) for (const e of lista) if (pertoPorPalavra(semAcento, normalizarResposta(e, true))) return { certo: true, quase: true, grafia: e.trim() };
  return ERRADA;
}
