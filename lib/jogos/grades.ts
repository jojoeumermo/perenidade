// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os jogos de grade: caça-palavras e palavras cruzadas. Tudo calculado aqui, sem tela, para o teste conferir.
import type { Sorteio } from "./base";
import { embaralhar } from "./base";

// ───────────────────────── Caça-palavras ─────────────────────────

export interface Colocada {
  palavra: string;
  r: number;
  c: number;
  dr: number;
  dc: number;
}
export interface CacaPalavras {
  tamanho: number;
  grade: string[][];
  colocadas: Colocada[];
}

const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Monta a grade. `facil` usa só as direções da esquerda para a direita e de cima para baixo (para crianças e para quem
 * está começando); no modo normal entram também as diagonais e as palavras de trás para a frente.
 */
export function gerarCacaPalavras(palavras: readonly string[], tamanho: number, rnd: Sorteio, facil = false): CacaPalavras {
  const direcoes = facil
    ? [[0, 1], [1, 0]]
    : [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]];
  const grade: (string | null)[][] = Array.from({ length: tamanho }, () => Array<string | null>(tamanho).fill(null));
  const colocadas: Colocada[] = [];
  const ordem = [...palavras].filter((p) => p.length <= tamanho).sort((a, b) => b.length - a.length);
  for (const palavra of ordem) {
    // Todas as posições onde a palavra cabe (sem bater em letra diferente); sorteia uma delas.
    const opcoes: Colocada[] = [];
    for (const [dr, dc] of direcoes) {
      for (let r = 0; r < tamanho; r++) {
        for (let c = 0; c < tamanho; c++) {
          const fr = r + dr * (palavra.length - 1);
          const fc = c + dc * (palavra.length - 1);
          if (fr < 0 || fr >= tamanho || fc < 0 || fc >= tamanho) continue;
          let cabe = true;
          for (let i = 0; i < palavra.length && cabe; i++) {
            const atual = grade[r + dr * i][c + dc * i];
            if (atual !== null && atual !== palavra[i]) cabe = false;
          }
          if (cabe) opcoes.push({ palavra, r, c, dr, dc });
        }
      }
    }
    if (!opcoes.length) continue;
    const o = opcoes[Math.floor(rnd() * opcoes.length)];
    for (let i = 0; i < palavra.length; i++) grade[o.r + o.dr * i][o.c + o.dc * i] = palavra[i];
    colocadas.push(o);
  }
  const cheia = grade.map((linha) => linha.map((letra) => letra ?? ALFABETO[Math.floor(rnd() * ALFABETO.length)]));
  return { tamanho, grade: cheia, colocadas };
}

/** As células de uma palavra colocada, na ordem. */
export function celulasDe(p: Colocada): [number, number][] {
  return Array.from({ length: p.palavra.length }, (_, i) => [p.r + p.dr * i, p.c + p.dc * i] as [number, number]);
}

/** A palavra (colocada) que vai de (r1,c1) a (r2,c2), nos dois sentidos, ou null. */
export function palavraNoTraco(jogo: CacaPalavras, r1: number, c1: number, r2: number, c2: number): Colocada | null {
  for (const p of jogo.colocadas) {
    const fim: [number, number] = [p.r + p.dr * (p.palavra.length - 1), p.c + p.dc * (p.palavra.length - 1)];
    if ((p.r === r1 && p.c === c1 && fim[0] === r2 && fim[1] === c2) || (p.r === r2 && p.c === c2 && fim[0] === r1 && fim[1] === c1)) return p;
  }
  return null;
}

// ───────────────────────── Palavras cruzadas ─────────────────────────

export interface EntradaCruzada {
  numero: number;
  dir: "H" | "V";
  r: number;
  c: number;
  palavra: string;
  dica: string;
}
export interface Cruzadas {
  linhas: number;
  colunas: number;
  /** null = casa preta. */
  letras: (string | null)[][];
  /** Número da dica no começo de palavra (0 = sem número). */
  numeros: number[][];
  entradas: EntradaCruzada[];
}

interface Semente {
  palavra: string;
  dica: string;
}

function tentarCruzadas(itens: readonly Semente[], rnd: Sorteio): Map<string, string> & { _col?: Colocada2[] } {
  const mapa = new Map<string, string>() as Map<string, string> & { _col?: Colocada2[] };
  const col: Colocada2[] = [];
  const chave = (r: number, c: number) => `${r},${c}`;
  const pode = (palavra: string, r: number, c: number, dir: "H" | "V"): number => {
    const dr = dir === "V" ? 1 : 0;
    const dc = dir === "H" ? 1 : 0;
    if (mapa.has(chave(r - dr, c - dc)) || mapa.has(chave(r + dr * palavra.length, c + dc * palavra.length))) return -1;
    let cruzamentos = 0;
    for (let i = 0; i < palavra.length; i++) {
      const rr = r + dr * i;
      const cc = c + dc * i;
      const atual = mapa.get(chave(rr, cc));
      if (atual !== undefined) {
        if (atual !== palavra[i]) return -1;
        cruzamentos++;
      } else if (mapa.has(chave(rr + dc, cc + dr)) || mapa.has(chave(rr - dc, cc - dr))) {
        return -1; // ficaria colada a outra palavra
      }
    }
    return cruzamentos;
  };
  const por = (p: Semente, r: number, c: number, dir: "H" | "V") => {
    for (let i = 0; i < p.palavra.length; i++) mapa.set(chave(r + (dir === "V" ? i : 0), c + (dir === "H" ? i : 0)), p.palavra[i]);
    col.push({ ...p, r, c, dir });
  };
  const [primeira, ...resto] = itens;
  por(primeira, 0, 0, "H");
  for (const p of resto) {
    const opcoes: { r: number; c: number; dir: "H" | "V" }[] = [];
    for (const q of col) {
      for (let i = 0; i < p.palavra.length; i++) {
        for (let j = 0; j < q.palavra.length; j++) {
          if (p.palavra[i] !== q.palavra[j]) continue;
          const dir = q.dir === "H" ? "V" : "H";
          const r = dir === "V" ? q.r - i : q.r + j;
          const c = dir === "V" ? q.c + j : q.c - i;
          if (pode(p.palavra, r, c, dir) === 1) opcoes.push({ r, c, dir });
        }
      }
    }
    if (opcoes.length) {
      const o = opcoes[Math.floor(rnd() * opcoes.length)];
      por(p, o.r, o.c, o.dir);
    }
  }
  mapa._col = col;
  return mapa;
}
interface Colocada2 extends Semente {
  r: number;
  c: number;
  dir: "H" | "V";
}

/**
 * Monta as palavras cruzadas com as palavras e dicas dadas: testa várias ordens e fica com a que encaixou mais palavras.
 * Cada palavra cruza outra em exatamente uma letra e nenhuma fica colada em paralelo a outra.
 */
export function gerarCruzadas(itens: readonly Semente[], rnd: Sorteio, tentativas = 40): Cruzadas | null {
  if (itens.length === 0) return null;
  let melhor: Colocada2[] = [];
  for (let t = 0; t < tentativas; t++) {
    const ordem = embaralhar(itens, rnd).sort((a, b) => b.palavra.length - a.palavra.length + (rnd() - 0.5) * 3);
    const col = tentarCruzadas(ordem, rnd)._col ?? [];
    if (col.length > melhor.length) melhor = col;
    if (melhor.length === itens.length) break;
  }
  if (melhor.length === 0) return null;
  const rs = melhor.map((p) => p.r);
  const cs = melhor.map((p) => p.c);
  const r0 = Math.min(...rs);
  const c0 = Math.min(...cs);
  const fim = (p: Colocada2) => [p.r + (p.dir === "V" ? p.palavra.length - 1 : 0), p.c + (p.dir === "H" ? p.palavra.length - 1 : 0)];
  const linhas = Math.max(...melhor.map((p) => fim(p)[0])) - r0 + 1;
  const colunas = Math.max(...melhor.map((p) => fim(p)[1])) - c0 + 1;
  const letras: (string | null)[][] = Array.from({ length: linhas }, () => Array<string | null>(colunas).fill(null));
  for (const p of melhor) for (let i = 0; i < p.palavra.length; i++) letras[p.r - r0 + (p.dir === "V" ? i : 0)][p.c - c0 + (p.dir === "H" ? i : 0)] = p.palavra[i];
  // Numeração na ordem de leitura; uma casa que começa uma horizontal e uma vertical leva um número só.
  const numeros: number[][] = Array.from({ length: linhas }, () => Array<number>(colunas).fill(0));
  const ordemLeitura = [...melhor].sort((a, b) => a.r - b.r || a.c - b.c || (a.dir === "H" ? -1 : 1));
  let n = 0;
  const entradas: EntradaCruzada[] = [];
  for (const p of ordemLeitura) {
    const r = p.r - r0;
    const c = p.c - c0;
    if (!numeros[r][c]) numeros[r][c] = ++n;
    entradas.push({ numero: numeros[r][c], dir: p.dir, r, c, palavra: p.palavra, dica: p.dica });
  }
  entradas.sort((a, b) => a.numero - b.numero || (a.dir === "H" ? -1 : 1));
  return { linhas, colunas, letras, numeros, entradas };
}
