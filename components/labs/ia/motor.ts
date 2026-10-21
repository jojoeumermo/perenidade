// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O motor do laboratório de IA, sem biblioteca: sorteio com semente, conjuntos de dados 2D, uma rede neural densa
// (perceptron de várias camadas) com retropropagação, k vizinhos, k-médias e regressão polinomial. Tudo em números
// comuns do JavaScript, no aparelho. Os testes estão em scripts/testar-ia.mjs.

/** Gerador de números com semente (mulberry32): a mesma semente dá sempre o mesmo resultado. */
export function sorteio(semente: number) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Normal padrão a partir de um sorteio uniforme (Box-Muller). */
export const normal = (r: () => number) => Math.sqrt(-2 * Math.log(r() || 1e-12)) * Math.cos(2 * Math.PI * r());

export interface Ponto {
  x: number;
  y: number;
  /** Classe: 1 ou -1. */
  c: 1 | -1;
}
export type Conjunto = "circulo" | "xor" | "espiral" | "nuvens";

/** Pontos no quadrado [-6, 6]², com ruído de 0 a 1. */
export function gerarDados(tipo: Conjunto, n: number, ruido: number, semente: number): Ponto[] {
  const r = sorteio(semente);
  const pts: Ponto[] = [];
  for (let i = 0; i < n; i++) {
    if (tipo === "circulo") {
      const dentro = i % 2 === 0;
      const raio = dentro ? r() * 2.5 : 3.5 + r() * 2;
      const ang = r() * Math.PI * 2;
      pts.push({ x: raio * Math.cos(ang) + normal(r) * ruido, y: raio * Math.sin(ang) + normal(r) * ruido, c: dentro ? 1 : -1 });
    } else if (tipo === "xor") {
      const x = (r() - 0.5) * 10;
      const y = (r() - 0.5) * 10;
      pts.push({ x: x + normal(r) * ruido, y: y + normal(r) * ruido, c: x * y >= 0 ? 1 : -1 });
    } else if (tipo === "espiral") {
      const braco = i % 2;
      const t = (Math.floor(i / 2) / (n / 2)) * 1.75 * Math.PI * 2;
      const raio = (t / (1.75 * Math.PI * 2)) * 5;
      const ang = t + braco * Math.PI;
      pts.push({ x: raio * Math.sin(ang) + normal(r) * ruido * 0.6, y: raio * Math.cos(ang) + normal(r) * ruido * 0.6, c: braco === 0 ? 1 : -1 });
    } else {
      const um = i % 2 === 0;
      pts.push({ x: (um ? 2 : -2) + normal(r) * (0.8 + ruido * 1.5), y: (um ? 2 : -2) + normal(r) * (0.8 + ruido * 1.5), c: um ? 1 : -1 });
    }
  }
  return pts;
}

export type Ativacao = "tanh" | "relu" | "sigmoide" | "linear";
const ATIV: Record<Ativacao, { f: (z: number) => number; d: (z: number, a: number) => number }> = {
  tanh: { f: Math.tanh, d: (_z, a) => 1 - a * a },
  relu: { f: (z) => (z > 0 ? z : 0), d: (z) => (z > 0 ? 1 : 0) },
  sigmoide: { f: (z) => 1 / (1 + Math.exp(-z)), d: (_z, a) => a * (1 - a) },
  linear: { f: (z) => z, d: () => 1 },
};

export type Caracteristica = "x1" | "x2" | "x1²" | "x2²" | "x1·x2" | "sen x1" | "sen x2";
export const CARACTERISTICAS: Caracteristica[] = ["x1", "x2", "x1²", "x2²", "x1·x2", "sen x1", "sen x2"];
export function entradas(x: number, y: number, usadas: Caracteristica[]): number[] {
  const v: Record<Caracteristica, number> = { x1: x / 6, x2: y / 6, "x1²": (x * x) / 36, "x2²": (y * y) / 36, "x1·x2": (x * y) / 36, "sen x1": Math.sin(x), "sen x2": Math.sin(y) };
  return usadas.map((k) => v[k]);
}

/** Uma rede densa: camadas[i] é o número de neurônios; a última camada tem um neurônio de saída (tanh, de -1 a 1). */
export interface Rede {
  camadas: number[];
  /** pesos[l][j][i]: da entrada i para o neurônio j da camada l+1. */
  pesos: number[][][];
  vieses: number[][];
  ativacao: Ativacao;
}

export function criarRede(nEntradas: number, ocultas: number[], ativacao: Ativacao, semente: number): Rede {
  const r = sorteio(semente);
  const camadas = [nEntradas, ...ocultas, 1];
  const pesos: number[][][] = [];
  const vieses: number[][] = [];
  for (let l = 0; l < camadas.length - 1; l++) {
    const escala = Math.sqrt(1 / camadas[l]);
    pesos.push(Array.from({ length: camadas[l + 1] }, () => Array.from({ length: camadas[l] }, () => normal(r) * escala)));
    vieses.push(Array.from({ length: camadas[l + 1] }, () => 0.1 * normal(r)));
  }
  return { camadas, pesos, vieses, ativacao };
}

/** Propaga a entrada; devolve as ativações de todas as camadas (a última é a saída). */
export function propagar(rede: Rede, x: number[]): { z: number[][]; a: number[][] } {
  const a: number[][] = [x];
  const z: number[][] = [x];
  for (let l = 0; l < rede.pesos.length; l++) {
    const ultima = l === rede.pesos.length - 1;
    const f = ultima ? Math.tanh : ATIV[rede.ativacao].f;
    const zl = rede.pesos[l].map((linha, j) => linha.reduce((s, w, i) => s + w * a[l][i], rede.vieses[l][j]));
    z.push(zl);
    a.push(zl.map(f));
  }
  return { z, a };
}
export const prever = (rede: Rede, x: number[]) => propagar(rede, x).a[rede.pesos.length][0];

/** Uma época de descida de gradiente em minilotes, com regularização L2 opcional. Muda a rede no lugar. */
export function treinar(rede: Rede, dados: { x: number[]; y: number }[], taxa: number, l2: number, lote: number, semente: number): void {
  const r = sorteio(semente);
  const ordem = dados.map((_, i) => i).sort(() => r() - 0.5);
  const L = rede.pesos.length;
  for (let inicio = 0; inicio < ordem.length; inicio += lote) {
    const gW = rede.pesos.map((m) => m.map((linha) => linha.map(() => 0)));
    const gB = rede.vieses.map((v) => v.map(() => 0));
    const fim = Math.min(ordem.length, inicio + lote);
    for (let k = inicio; k < fim; k++) {
      const { x, y } = dados[ordem[k]];
      const { z, a } = propagar(rede, x);
      // Erro quadrático na saída (tanh).
      let delta = [(a[L][0] - y) * (1 - a[L][0] * a[L][0])];
      for (let l = L - 1; l >= 0; l--) {
        for (let j = 0; j < delta.length; j++) {
          gB[l][j] += delta[j];
          for (let i = 0; i < a[l].length; i++) gW[l][j][i] += delta[j] * a[l][i];
        }
        if (l > 0) {
          const d = ATIV[rede.ativacao].d;
          delta = a[l].map((ai, i) => delta.reduce((s, dj, j) => s + dj * rede.pesos[l][j][i], 0) * d(z[l][i], ai));
        }
      }
    }
    const n = fim - inicio;
    for (let l = 0; l < L; l++) {
      for (let j = 0; j < rede.pesos[l].length; j++) {
        for (let i = 0; i < rede.pesos[l][j].length; i++) rede.pesos[l][j][i] -= taxa * (gW[l][j][i] / n + l2 * rede.pesos[l][j][i]);
        rede.vieses[l][j] -= taxa * (gB[l][j] / n);
      }
    }
  }
}

/** Perda média (erro quadrático) e acerto de um conjunto. */
export function avaliar(rede: Rede, dados: { x: number[]; y: number }[]) {
  let perda = 0;
  let certos = 0;
  for (const { x, y } of dados) {
    const p = prever(rede, x);
    perda += 0.5 * (p - y) ** 2;
    if (Math.sign(p) === Math.sign(y)) certos++;
  }
  return { perda: perda / Math.max(1, dados.length), acerto: certos / Math.max(1, dados.length) };
}

/** k vizinhos mais próximos: a classe da maioria dos k pontos mais perto. */
export function knn(pontos: Ponto[], x: number, y: number, k: number): 1 | -1 {
  const viz = [...pontos].sort((a, b) => (a.x - x) ** 2 + (a.y - y) ** 2 - ((b.x - x) ** 2 + (b.y - y) ** 2)).slice(0, k);
  const soma = viz.reduce((s, p) => s + p.c, 0);
  return soma >= 0 ? 1 : -1;
}

/** Um passo do k-médias: cada ponto vai ao centro mais perto; cada centro vai para a média dos seus pontos. */
export function passoKMedias(pts: { x: number; y: number }[], centros: { x: number; y: number }[]) {
  const grupo = pts.map((p) => {
    let melhor = 0;
    centros.forEach((c, i) => {
      if ((p.x - c.x) ** 2 + (p.y - c.y) ** 2 < (p.x - centros[melhor].x) ** 2 + (p.y - centros[melhor].y) ** 2) melhor = i;
    });
    return melhor;
  });
  const novos = centros.map((c, i) => {
    const meus = pts.filter((_, k) => grupo[k] === i);
    return meus.length ? { x: meus.reduce((s, p) => s + p.x, 0) / meus.length, y: meus.reduce((s, p) => s + p.y, 0) / meus.length } : c;
  });
  const inercia = pts.reduce((s, p, k) => s + (p.x - novos[grupo[k]].x) ** 2 + (p.y - novos[grupo[k]].y) ** 2, 0);
  return { grupo, centros: novos, inercia };
}

/** Mínimos quadrados para um polinômio de grau g (eliminação de Gauss nas equações normais). */
export function ajustarPolinomio(xs: number[], ys: number[], grau: number): number[] {
  const n = grau + 1;
  const A = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => xs.reduce((s, x) => s + x ** (i + j), 0)));
  const b = Array.from({ length: n }, (_, i) => xs.reduce((s, x, k) => s + ys[k] * x ** i, 0));
  // Um pouquinho de regularização evita a matriz singular nos graus altos.
  for (let i = 0; i < n; i++) A[i][i] += 1e-9;
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let l = c + 1; l < n; l++) if (Math.abs(A[l][c]) > Math.abs(A[piv][c])) piv = l;
    [A[c], A[piv]] = [A[piv], A[c]];
    [b[c], b[piv]] = [b[piv], b[c]];
    for (let l = c + 1; l < n; l++) {
      const f = A[l][c] / A[c][c];
      for (let k = c; k < n; k++) A[l][k] -= f * A[c][k];
      b[l] -= f * b[c];
    }
  }
  const coef = Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) coef[i] = (b[i] - A[i].slice(i + 1).reduce((s, a, k) => s + a * coef[i + 1 + k], 0)) / A[i][i];
  return coef;
}
export const polinomio = (coef: number[], x: number) => coef.reduce((s, c, i) => s + c * x ** i, 0);

/** Modelo de "próxima palavra" por contagem de pares (bigramas): a base dos modelos de linguagem, em miniatura. */
export function bigramas(texto: string): Map<string, Map<string, number>> {
  const palavras = texto.toLowerCase().replace(/[^\p{L}\p{N}\s.!?]/gu, " ").replace(/([.!?])/g, " $1 ").split(/\s+/).filter(Boolean);
  const m = new Map<string, Map<string, number>>();
  for (let i = 0; i < palavras.length - 1; i++) {
    const seg = m.get(palavras[i]) ?? new Map<string, number>();
    seg.set(palavras[i + 1], (seg.get(palavras[i + 1]) ?? 0) + 1);
    m.set(palavras[i], seg);
  }
  return m;
}
/** As próximas palavras possíveis com a probabilidade, depois da temperatura (baixa: escolhe a mais comum). */
export function proximas(m: Map<string, Map<string, number>>, palavra: string, temperatura: number): [string, number][] {
  const seg = m.get(palavra.toLowerCase());
  if (!seg) return [];
  const t = Math.max(0.05, temperatura);
  const pesos = [...seg.entries()].map(([p, n]) => [p, Math.pow(n, 1 / t)] as [string, number]);
  const total = pesos.reduce((s, [, w]) => s + w, 0);
  return pesos.map(([p, w]) => [p, w / total] as [string, number]).sort((a, b) => b[1] - a[1]);
}
