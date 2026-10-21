// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O motor do Laboratório de modelos: probabilidade, modelos sociais (segregação, cooperação, riqueza), epidemia,
// predador e presa, órbitas, séries de Fourier e autômatos celulares. Funções puras, com sorteio de semente (a mesma
// semente repete o resultado, para o professor mostrar igual em sala). Testes em scripts/testar-modelos.mjs.
import { sorteio } from "../ia/motor";

export { sorteio };

// ───────────── Probabilidade ─────────────

/** Monty Hall: n rodadas; devolve a fração de vitórias trocando e sem trocar de porta. */
export function montyHall(n: number, semente: number) {
  const r = sorteio(semente);
  let ganhaTrocando = 0;
  let ganhaFicando = 0;
  for (let i = 0; i < n; i++) {
    const carro = Math.floor(r() * 3);
    const escolha = Math.floor(r() * 3);
    if (escolha === carro) ganhaFicando++;
    else ganhaTrocando++;
  }
  return { trocando: ganhaTrocando / n, ficando: ganhaFicando / n };
}

/** Chance exata de pelo menos dois aniversários iguais num grupo de n pessoas (365 dias, sem 29/2). */
export function aniversarioExato(n: number) {
  let diferentes = 1;
  for (let i = 0; i < n; i++) diferentes *= (365 - i) / 365;
  return 1 - diferentes;
}

/** Lançamentos de moeda: a fração de caras ao longo do tempo (lei dos grandes números). */
export function moedas(n: number, semente: number, pCara = 0.5) {
  const r = sorteio(semente);
  let caras = 0;
  const serie: number[] = [];
  for (let i = 1; i <= n; i++) {
    if (r() < pCara) caras++;
    serie.push(caras / i);
  }
  return serie;
}

/** Médias de amostras de k dados (teorema central do limite): histograma das médias. */
export function mediasDeDados(amostras: number, k: number, semente: number) {
  const r = sorteio(semente);
  return Array.from({ length: amostras }, () => {
    let s = 0;
    for (let i = 0; i < k; i++) s += 1 + Math.floor(r() * 6);
    return s / k;
  });
}

// ───────────── Segregação (modelo de Schelling) ─────────────

export type Celula = 0 | 1 | 2;
/** Grade com dois grupos (1 e 2) e casas vazias (0). */
export function schellingInicial(lado: number, vazias: number, semente: number): Celula[] {
  const r = sorteio(semente);
  return Array.from({ length: lado * lado }, () => (r() < vazias ? 0 : r() < 0.5 ? 1 : 2));
}
/** Fração de vizinhos iguais de uma casa (0 se não tem vizinhos ocupados). */
function vizinhosIguais(g: Celula[], lado: number, i: number) {
  const x = i % lado;
  const y = Math.floor(i / lado);
  let iguais = 0;
  let ocupados = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = (x + dx + lado) % lado;
      const ny = (y + dy + lado) % lado;
      const v = g[ny * lado + nx];
      if (v) {
        ocupados++;
        if (v === g[i]) iguais++;
      }
    }
  }
  return ocupados ? iguais / ocupados : 1;
}
/** Uma rodada: quem tem menos vizinhos iguais do que tolera muda para uma casa vazia ao acaso. */
export function schellingPasso(g: Celula[], lado: number, tolerancia: number, semente: number) {
  const r = sorteio(semente);
  const nova = [...g];
  const vazias = nova.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
  let mudaram = 0;
  for (let i = 0; i < nova.length; i++) {
    if (!nova[i] || vizinhosIguais(nova, lado, i) >= tolerancia || !vazias.length) continue;
    const k = Math.floor(r() * vazias.length);
    const destino = vazias[k];
    nova[destino] = nova[i];
    nova[i] = 0;
    vazias[k] = i;
    mudaram++;
  }
  return { grade: nova, mudaram };
}
/** Segregação média: a fração média de vizinhos iguais. */
export function segregacao(g: Celula[], lado: number) {
  const ocupadas = g.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
  return ocupadas.reduce((s, i) => s + vizinhosIguais(g, lado, i), 0) / Math.max(1, ocupadas.length);
}

// ───────────── Cooperação (dilema do prisioneiro repetido) ─────────────

export type Estrategia = "sempre-coopera" | "sempre-trai" | "olho-por-olho" | "rancoroso" | "aleatorio";
export const ESTRATEGIAS: { id: Estrategia; nome: string; regra: string }[] = [
  { id: "sempre-coopera", nome: "Sempre coopera", regra: "Coopera sempre, aconteça o que acontecer." },
  { id: "sempre-trai", nome: "Sempre trai", regra: "Trai sempre." },
  { id: "olho-por-olho", nome: "Olho por olho", regra: "Começa cooperando e depois repete o que o outro fez na rodada anterior." },
  { id: "rancoroso", nome: "Rancoroso", regra: "Coopera até ser traído uma vez; depois trai para sempre." },
  { id: "aleatorio", nome: "Aleatório", regra: "Cara ou coroa a cada rodada." },
];
/** Pontos: os dois cooperam 3 e 3; um trai e o outro coopera 5 e 0; os dois traem 1 e 1. */
function jogada(e: Estrategia, meu: boolean[], dele: boolean[], r: () => number): boolean {
  if (e === "sempre-coopera") return true;
  if (e === "sempre-trai") return false;
  if (e === "olho-por-olho") return dele.length ? dele[dele.length - 1] : true;
  if (e === "rancoroso") return !dele.includes(false);
  void meu;
  return r() < 0.5;
}
export function partida(a: Estrategia, b: Estrategia, rodadas: number, semente: number) {
  const r = sorteio(semente);
  const ja: boolean[] = [];
  const jb: boolean[] = [];
  let pa = 0;
  let pb = 0;
  for (let i = 0; i < rodadas; i++) {
    const x = jogada(a, ja, jb, r);
    const y = jogada(b, jb, ja, r);
    ja.push(x);
    jb.push(y);
    if (x && y) { pa += 3; pb += 3; } else if (x && !y) pb += 5; else if (!x && y) pa += 5; else { pa += 1; pb += 1; }
  }
  return [pa, pb] as const;
}
/** Campeonato todos contra todos: a soma de pontos de cada estratégia presente. */
export function campeonato(participantes: Estrategia[], rodadas: number, semente: number) {
  const pontos = participantes.map(() => 0);
  for (let i = 0; i < participantes.length; i++) {
    for (let j = i + 1; j < participantes.length; j++) {
      const [a, b] = partida(participantes[i], participantes[j], rodadas, semente + i * 31 + j);
      pontos[i] += a;
      pontos[j] += b;
    }
  }
  return pontos;
}

// ───────────── Riqueza (modelo "yard-sale") ─────────────

/** Trocas "justas" ao acaso: em cada uma, quem perde entrega uma fração da riqueza do MAIS POBRE dos dois. */
export function yardSale(riquezas: number[], trocas: number, fracao: number, semente: number, imposto = 0) {
  const r = sorteio(semente);
  const w = [...riquezas];
  for (let t = 0; t < trocas; t++) {
    const i = Math.floor(r() * w.length);
    let j = Math.floor(r() * w.length);
    if (j === i) j = (j + 1) % w.length;
    const aposta = fracao * Math.min(w[i], w[j]);
    if (r() < 0.5) { w[i] += aposta; w[j] -= aposta; } else { w[i] -= aposta; w[j] += aposta; }
  }
  if (imposto > 0) {
    const media = w.reduce((s, x) => s + x, 0) / w.length;
    for (let i = 0; i < w.length; i++) w[i] += imposto * (media - w[i]);
  }
  return w;
}
/** Índice de Gini (0 = todos iguais, 1 = um só tem tudo). */
export function gini(w: number[]) {
  const s = [...w].sort((a, b) => a - b);
  const n = s.length;
  const total = s.reduce((a, b) => a + b, 0);
  if (!total) return 0;
  const acum = s.reduce((a, x, i) => a + (2 * (i + 1) - n - 1) * x, 0);
  return acum / (n * total);
}

// ───────────── Epidemia (SIR) e predador e presa (Lotka-Volterra) ─────────────

/** Modelo SIR por passos de um dia (Euler). beta: contágio por contato; gama: recuperação; vacinados saem dos suscetíveis. */
export function sir(dias: number, beta: number, gama: number, vacinados: number, infectados0 = 0.001) {
  let S = Math.max(0, 1 - vacinados - infectados0);
  let I = infectados0;
  let R = vacinados;
  const serie: { S: number; I: number; R: number }[] = [{ S, I, R }];
  const dt = 0.1;
  for (let d = 0; d < dias; d++) {
    for (let k = 0; k < 10; k++) {
      const novos = beta * S * I * dt;
      const curados = gama * I * dt;
      S -= novos;
      I += novos - curados;
      R += curados;
    }
    serie.push({ S, I, R });
  }
  return serie;
}

/** Lotka-Volterra (Runge-Kutta 4): presas crescem e são comidas; predadores comem e morrem de fome. */
export function lotkaVolterra(passos: number, dt: number, p: { a: number; b: number; c: number; d: number }, presas0: number, predadores0: number) {
  const f = (x: number, y: number) => [p.a * x - p.b * x * y, p.d * x * y - p.c * y];
  let x = presas0;
  let y = predadores0;
  const serie: [number, number][] = [[x, y]];
  for (let i = 0; i < passos; i++) {
    const [k1x, k1y] = f(x, y);
    const [k2x, k2y] = f(x + (dt / 2) * k1x, y + (dt / 2) * k1y);
    const [k3x, k3y] = f(x + (dt / 2) * k2x, y + (dt / 2) * k2y);
    const [k4x, k4y] = f(x + dt * k3x, y + dt * k3y);
    x += (dt / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
    y += (dt / 6) * (k1y + 2 * k2y + 2 * k3y + k4y);
    serie.push([x, y]);
  }
  return serie;
}

// ───────────── Órbitas ─────────────

/** Um planeta em torno de uma estrela fixa (Verlet), em unidades onde G·M = 1. Devolve as posições. */
export function orbita(passos: number, dt: number, x0: number, vy0: number) {
  let x = x0;
  let y = 0;
  let vx = 0;
  let vy = vy0;
  const pts: [number, number][] = [[x, y]];
  const acel = (px: number, py: number) => {
    const r3 = Math.pow(px * px + py * py, 1.5);
    return [-px / r3, -py / r3];
  };
  let [ax, ay] = acel(x, y);
  for (let i = 0; i < passos; i++) {
    x += vx * dt + 0.5 * ax * dt * dt;
    y += vy * dt + 0.5 * ay * dt * dt;
    const [nax, nay] = acel(x, y);
    vx += 0.5 * (ax + nax) * dt;
    vy += 0.5 * (ay + nay) * dt;
    ax = nax;
    ay = nay;
    pts.push([x, y]);
    if (x * x + y * y < 0.0025) break;
  }
  const energia = 0.5 * (vx * vx + vy * vy) - 1 / Math.hypot(x, y);
  return { pts, energia };
}

/** Lançamento oblíquo sem ar: alcance e altura máxima (g = 9,8 m/s²). */
export function projetil(v: number, anguloGraus: number, g = 9.8) {
  const a = (anguloGraus * Math.PI) / 180;
  return { alcance: (v * v * Math.sin(2 * a)) / g, altura: (v * v * Math.sin(a) ** 2) / (2 * g), tempo: (2 * v * Math.sin(a)) / g };
}

// ───────────── Fourier ─────────────

/** Soma parcial da série de Fourier de uma onda quadrada, dente de serra ou triangular, com n termos. */
export function fourier(tipo: "quadrada" | "serra" | "triangular", n: number, t: number) {
  let s = 0;
  for (let k = 1; k <= n; k++) {
    if (tipo === "quadrada") { const m = 2 * k - 1; s += Math.sin(m * t) / m; }
    else if (tipo === "serra") s += (Math.pow(-1, k + 1) * Math.sin(k * t)) / k;
    else { const m = 2 * k - 1; s += (Math.pow(-1, k - 1) * Math.sin(m * t)) / (m * m); }
  }
  return tipo === "quadrada" ? (4 / Math.PI) * s : tipo === "serra" ? (2 / Math.PI) * s : (8 / (Math.PI * Math.PI)) * s;
}

// ───────────── Autômatos celulares ─────────────

/** Jogo da Vida de Conway, numa grade com bordas que dão a volta. */
export function vidaPasso(g: boolean[], lado: number) {
  return g.map((viva, i) => {
    const x = i % lado;
    const y = Math.floor(i / lado);
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && g[((y + dy + lado) % lado) * lado + ((x + dx + lado) % lado)]) n++;
    return viva ? n === 2 || n === 3 : n === 3;
  });
}
/** Um autômato elementar (regra de Wolfram, de 0 a 255) numa linha. */
export function regraPasso(linha: boolean[], regra: number) {
  return linha.map((_, i) => {
    const e = linha[(i - 1 + linha.length) % linha.length] ? 4 : 0;
    const c = linha[i] ? 2 : 0;
    const d = linha[(i + 1) % linha.length] ? 1 : 0;
    return ((regra >> (e + c + d)) & 1) === 1;
  });
}
