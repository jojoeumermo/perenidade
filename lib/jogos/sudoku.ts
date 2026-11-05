// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Sudoku de 4x4 (crianças), 6x6 e 9x9. O quebra-cabeça sempre tem uma solução só (conferido a cada remoção).
import type { Sorteio } from "./base";
import { embaralhar } from "./base";

export interface Medida {
  n: number;
  /** Altura e largura do bloco (2x2, 2x3, 3x3). */
  bl: number;
  bc: number;
}
export const MEDIDAS: Record<4 | 6 | 9, Medida> = { 4: { n: 4, bl: 2, bc: 2 }, 6: { n: 6, bl: 2, bc: 3 }, 9: { n: 9, bl: 3, bc: 3 } };

export type Tamanho = keyof typeof MEDIDAS;

/** Quantas casas já vêm preenchidas, por tamanho e dificuldade. */
export const PISTAS: Record<Tamanho, { facil: number; medio: number }> = { 4: { facil: 10, medio: 8 }, 6: { facil: 24, medio: 18 }, 9: { facil: 40, medio: 32 } };

const bloco = (m: Medida, r: number, c: number) => Math.floor(r / m.bl) * (m.n / m.bc) + Math.floor(c / m.bc);

function candidatos(m: Medida, g: number[], r: number, c: number): number[] {
  const usados = new Set<number>();
  for (let i = 0; i < m.n; i++) {
    usados.add(g[r * m.n + i]);
    usados.add(g[i * m.n + c]);
  }
  const b = bloco(m, r, c);
  for (let i = 0; i < m.n; i++)
    for (let j = 0; j < m.n; j++) if (bloco(m, i, j) === b) usados.add(g[i * m.n + j]);
  const livres: number[] = [];
  for (let v = 1; v <= m.n; v++) if (!usados.has(v)) livres.push(v);
  return livres;
}

/** Conta as soluções (para em `limite`), sempre escolhendo a casa com menos candidatos. */
export function contarSolucoes(m: Medida, grade: readonly number[], limite = 2): number {
  const g = [...grade];
  let total = 0;
  const passo = (): void => {
    if (total >= limite) return;
    let melhor = -1;
    let melhores: number[] = [];
    for (let i = 0; i < g.length; i++) {
      if (g[i] !== 0) continue;
      const cand = candidatos(m, g, Math.floor(i / m.n), i % m.n);
      if (melhor < 0 || cand.length < melhores.length) {
        melhor = i;
        melhores = cand;
        if (cand.length === 0) return;
      }
    }
    if (melhor < 0) {
      total++;
      return;
    }
    for (const v of melhores) {
      g[melhor] = v;
      passo();
      g[melhor] = 0;
      if (total >= limite) return;
    }
  };
  passo();
  return total;
}

function solucaoCompleta(m: Medida, rnd: Sorteio): number[] {
  const g = Array<number>(m.n * m.n).fill(0);
  const passo = (i: number): boolean => {
    if (i === g.length) return true;
    for (const v of embaralhar(candidatos(m, g, Math.floor(i / m.n), i % m.n), rnd)) {
      g[i] = v;
      if (passo(i + 1)) return true;
    }
    g[i] = 0;
    return false;
  };
  passo(0);
  return g;
}

export interface Sudoku {
  medida: Medida;
  /** Casas dadas (0 = vazia). */
  dadas: number[];
  solucao: number[];
}

export function gerarSudoku(tamanho: Tamanho, dificuldade: "facil" | "medio", rnd: Sorteio): Sudoku {
  const medida = MEDIDAS[tamanho];
  const solucao = solucaoCompleta(medida, rnd);
  const dadas = [...solucao];
  const alvo = PISTAS[tamanho][dificuldade];
  for (const i of embaralhar(dadas.map((_, k) => k), rnd)) {
    if (dadas.filter((v) => v !== 0).length <= alvo) break;
    const guardado = dadas[i];
    dadas[i] = 0;
    if (contarSolucoes(medida, dadas) !== 1) dadas[i] = guardado;
  }
  return { medida, dadas, solucao };
}

/** As casas que repetem número na linha, na coluna ou no bloco. */
export function conflitos(m: Medida, g: readonly number[]): Set<number> {
  const ruins = new Set<number>();
  for (let i = 0; i < g.length; i++) {
    if (!g[i]) continue;
    for (let j = i + 1; j < g.length; j++) {
      if (g[i] !== g[j]) continue;
      const ri = Math.floor(i / m.n);
      const ci = i % m.n;
      const rj = Math.floor(j / m.n);
      const cj = j % m.n;
      if (ri === rj || ci === cj || bloco(m, ri, ci) === bloco(m, rj, cj)) {
        ruins.add(i);
        ruins.add(j);
      }
    }
  }
  return ruins;
}

export const bloqueDa = bloco;
