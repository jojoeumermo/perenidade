// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O laboratório da TRI: o modelo logístico de 3 parâmetros (Birnbaum), em duas partes.
// (1) Itens ILUSTRATIVOS (Item, probabilidade, estimarTheta, ITENS_ILUSTRATIVOS), só para mostrar a coerência e o
//     parâmetro c. Não são itens de nenhuma prova.
// (2) Estimativa da nota com os parâmetros REAIS dos itens (seção "TRI com parâmetros reais"): o Inep publica
//     NU_PARAM_A, NU_PARAM_B e NU_PARAM_C de cada item nos microdados (arquivo ITENS_PROVA). A nota é estimada pelo EAP
//     (esperança a posteriori, priori normal, 40 pontos de quadratura) e levada à escala (500, 100) da referência de
//     2009: nota = 500 + 100·θ. É uma ESTIMATIVA: o Inep recalibra os itens a cada edição e calcula a nota oficial com o
//     banco inteiro de participantes (edital, item 14.3). Fontes: Inep, "Enem: procedimentos de análise" e nota técnica
//     "Procedimento de cálculo das notas do Enem" (2011); ver docs/ENEM-TRI.md.
// Sem os atalhos "@/" de propósito: `npm run testar:enem` e `npm run testar:tri` rodam este arquivo direto no Node.

export interface Item {
  /** Discriminação: quanto a chance de acertar muda perto da dificuldade. */
  a: number;
  /** Dificuldade: a proficiência em que a chance (sem contar o chute) chega à metade. */
  b: number;
  /** Acerto ao acaso: a chance de acertar sem saber (com 5 alternativas, por volta de 0,2). */
  c: number;
}

/** P(acerto | θ) = c + (1 − c) / (1 + e^(−a(θ − b))) */
export function probabilidade(item: Item, theta: number): number {
  return item.c + (1 - item.c) / (1 + Math.exp(-item.a * (theta - item.b)));
}

/** A log-verossimilhança de um padrão de respostas (true = acertou) para uma proficiência θ. */
export function verossimilhanca(itens: Item[], respostas: boolean[], theta: number): number {
  return itens.reduce((s, it, i) => {
    const p = Math.min(1 - 1e-12, Math.max(1e-12, probabilidade(it, theta)));
    return s + (respostas[i] ? Math.log(p) : Math.log(1 - p));
  }, 0);
}

/**
 * A proficiência estimada: o θ (entre −4 e 4) que torna o padrão de respostas mais provável, com uma leve preferência
 * pelo centro (o que evita estimativa infinita quando a pessoa acerta ou erra tudo). Busca em grade, passo 0,01.
 */
export function estimarTheta(itens: Item[], respostas: boolean[]): number {
  let melhor = 0;
  let valor = -Infinity;
  for (let t = -400; t <= 400; t++) {
    const theta = t / 100;
    const v = verossimilhanca(itens, respostas, theta) - (theta * theta) / 2;
    if (v > valor) {
      valor = v;
      melhor = theta;
    }
  }
  return melhor;
}

/** Dez itens ilustrativos, do mais fácil ao mais difícil, todos com a mesma discriminação e chute de 0,2. */
export const ITENS_ILUSTRATIVOS: Item[] = [-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2, 2.5].map((b) => ({ a: 1.5, b, c: 0.2 }));

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// TRI com parâmetros reais (itens publicados pelo Inep). Escala (0, 1) nos itens; a nota é 500 + 100·θ.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Constante de escala da logística. O texto público do Inep dá o modelo (Birnbaum, 3 parâmetros), mas a fórmula está
 * numa figura e não diz, em texto, se usa D = 1,7 (aproxima a ogiva normal; é o costume do BILOG-MG e da literatura
 * brasileira, Andrade, Tavares e Valle, 2000) ou D = 1. Padrão aqui: 1,7. O laboratório deixa trocar, para a pessoa
 * ver quanto isso mexe na nota, e a página declara a dúvida.
 */
export const D_PADRAO = 1.7;

/** P(acerto | θ) = c + (1 − c) / (1 + e^(−D·a·(θ − b))). */
export function probabilidadeD(item: Item, theta: number, D: number = D_PADRAO): number {
  return item.c + (1 - item.c) / (1 + Math.exp(-D * item.a * (theta - item.b)));
}

/** Nota na escala do Enem a partir de θ (0, 1): 500 + 100·θ (Inep, "Procedimentos de análise", seção Escala). */
export const notaDeTheta = (theta: number): number => 500 + 100 * theta;
/** θ (0, 1) a partir da nota. */
export const thetaDeNota = (nota: number): number => (nota - 500) / 100;

export interface Estimativa {
  /** θ estimado (EAP), escala (0, 1). */
  theta: number;
  /** Desvio-padrão da posteriori: a incerteza da estimativa, escala (0, 1). */
  dp: number;
  /** Nota estimada (500 + 100·θ). */
  nota: number;
  /** Desvio-padrão da nota, em pontos. */
  notaDp: number;
  /** Intervalo de 95% pela posteriori (±1,96 desvio-padrão), em pontos de nota. */
  ic95: [number, number];
}

/** Os pontos de quadratura: n pontos igualmente espaçados em [−4, 4], com pesos da normal padrão normalizados. */
export function quadratura(n = 40): { x: number[]; w: number[] } {
  const x = Array.from({ length: n }, (_, i) => -4 + (8 * i) / (n - 1));
  const bruto = x.map((v) => Math.exp(-(v * v) / 2));
  const soma = bruto.reduce((s, v) => s + v, 0);
  return { x, w: bruto.map((v) => v / soma) };
}

function logVerossimilhancaD(itens: Item[], respostas: (boolean | null)[], theta: number, D: number): number {
  let logL = 0;
  for (let i = 0; i < itens.length; i++) {
    const r = respostas[i];
    if (r === null || r === undefined) continue;
    const p = Math.min(1 - 1e-12, Math.max(1e-12, probabilidadeD(itens[i], theta, D)));
    logL += r ? Math.log(p) : Math.log(1 - p);
  }
  return logL;
}

/**
 * EAP, o método do Inep: θ̂ = ∫ θ·L(x|θ)·f(θ) dθ ÷ ∫ L(x|θ)·f(θ) dθ, com priori normal padrão e 40 pontos de quadratura.
 * `respostas[i]` é true (acertou), false (errou ou em branco) ou null (item fora da conta: não entra na verossimilhança).
 */
export function estimarEap(itens: Item[], respostas: (boolean | null)[], opcoes: { D?: number; pontos?: number } = {}): Estimativa {
  const D = opcoes.D ?? D_PADRAO;
  const { x, w } = quadratura(opcoes.pontos ?? 40);
  const logs = x.map((theta) => logVerossimilhancaD(itens, respostas, theta, D));
  const maior = Math.max(...logs);
  const pesos = logs.map((l, k) => Math.exp(l - maior) * w[k]);
  const total = pesos.reduce((s, v) => s + v, 0);
  const theta = pesos.reduce((s, v, k) => s + v * x[k], 0) / total;
  const dp = Math.sqrt(pesos.reduce((s, v, k) => s + v * (x[k] - theta) ** 2, 0) / total);
  return { theta, dp, nota: notaDeTheta(theta), notaDp: dp * 100, ic95: [notaDeTheta(theta - 1.96 * dp), notaDeTheta(theta + 1.96 * dp)] };
}

/** Máxima verossimilhança (grade, passo 0,01 em [−4, 4]); nulo quando acertou ou errou tudo (não há máximo). */
export function estimarMl(itens: Item[], respostas: (boolean | null)[], D: number = D_PADRAO): number | null {
  const validas = respostas.filter((r): r is boolean => r !== null && r !== undefined);
  if (validas.length === 0 || validas.every(Boolean) || validas.every((r) => !r)) return null;
  let melhor = 0;
  let valor = -Infinity;
  for (let t = -400; t <= 400; t++) {
    const theta = t / 100;
    const v = logVerossimilhancaD(itens, respostas, theta, D);
    if (v > valor) {
      valor = v;
      melhor = theta;
    }
  }
  return melhor;
}

/** Corrige uma sequência de letras (A a E; qualquer outro caractere conta como branco) contra o gabarito oficial. */
export function corrigirLetras(itens: { g?: string }[], letras: string): boolean[] {
  const l = letras.toUpperCase().replace(/\s/g, "");
  return itens.map((it, i) => !!it.g && l[i] === it.g);
}

/**
 * Para k acertos, a menor e a maior nota possíveis (acertando só os k mais fáceis ou só os k mais difíceis): mostra que
 * o número de acertos não fixa a nota. Os itens fora da conta (sem parâmetro) devem vir já filtrados.
 */
export function faixaPorAcertos(itens: Item[], opcoes: { D?: number } = {}): { acertos: number; min: number; max: number }[] {
  const ordem = [...itens].sort((p, q) => p.b - q.b);
  const faixa: { acertos: number; min: number; max: number }[] = [];
  for (let k = 0; k <= ordem.length; k++) {
    const faceis = ordem.map((_, i) => i < k);
    const dificeis = ordem.map((_, i) => i >= ordem.length - k);
    const x = estimarEap(ordem, faceis, opcoes).nota;
    const y = estimarEap(ordem, dificeis, opcoes).nota;
    faixa.push({ acertos: k, min: Math.min(x, y), max: Math.max(x, y) });
  }
  return faixa;
}

/** O que o arquivo public/tri/enem-AAAA.json guarda por item (gerado por scripts/enem/gerar-parametros-tri.mjs). */
export interface ItemDoArquivo {
  /** CO_ITEM, o código do item nos microdados. */
  co: number;
  /** CO_POSICAO no caderno. */
  p: number;
  /** TX_GABARITO. */
  g: string;
  a?: number;
  b?: number;
  c?: number;
  /** Item abandonado pelo Inep: fica fora do cálculo. */
  aban?: true;
  /** CO_HABILIDADE. */
  h?: number;
  /** Id da questão correspondente em public/questoes/enem-AAAA.json, quando o site a tem. */
  q?: string;
}
export interface AreaDoArquivo {
  prova: number;
  cor: string;
  casadoComSite: boolean;
  ligadas: number;
  itens: ItemDoArquivo[];
  idiomas?: { ingles: ItemDoArquivo[]; espanhol: ItemDoArquivo[] };
}
export type AreaDoEnem = "linguagens" | "humanas" | "natureza" | "matematica";
export interface ProvaDoArquivo {
  ano: number;
  fonte: string;
  url: string;
  areas: Record<AreaDoEnem, AreaDoArquivo>;
}

export type ItemDaArea = ItemDoArquivo & { fora: boolean };

/** Os itens de uma área na ordem do caderno (idioma antes dos comuns, em linguagens); `fora` marca os sem parâmetro. */
export function itensDaArea(area: AreaDoArquivo, idioma: "ingles" | "espanhol" = "ingles"): ItemDaArea[] {
  const lista = area.idiomas ? [...area.idiomas[idioma], ...area.itens] : area.itens;
  return lista.map((i) => ({ ...i, fora: !!i.aban || i.a === undefined || i.b === undefined || i.c === undefined }));
}
