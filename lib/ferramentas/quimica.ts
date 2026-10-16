// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Química: a massa molar a partir da fórmula (com parênteses, colchetes e hidratos) e o balanceamento de equações
// pelo método algébrico, com os menores coeficientes inteiros. A tabela de massas vem de lib/elementos.json, passada
// por quem chama (o módulo fica sem import de JSON para os roteiros de conferência rodarem no Node puro).

export class ErroDeQuimica extends Error {
  codigo: "vazio" | "simbolo" | "elemento" | "parentese" | "seta" | "lado" | "sem_solucao" | "varias_solucoes" | "carga";
  detalhe: string;
  constructor(codigo: ErroDeQuimica["codigo"], detalhe = "") {
    super(codigo);
    this.codigo = codigo;
    this.detalhe = detalhe;
  }
}

export type Contagem = Map<string, number>;

function somar(a: Contagem, b: Contagem, vezes = 1) {
  for (const [el, n] of b) a.set(el, (a.get(el) ?? 0) + n * vezes);
}

/**
 * Lê uma fórmula: H2O, Ca(OH)2, K4[Fe(CN)6], CuSO4·5H2O (o ponto do hidrato pode ser "·", "." ou "*"). Devolve quantos
 * átomos de cada elemento, na ordem em que aparecem. `existe` diz se um símbolo é um elemento de verdade.
 */
export function lerFormula(formula: string, existe: (simbolo: string) => boolean): Contagem {
  const texto = formula.replace(/\s+/g, "").replace(/[₀-₉]/g, (c) => String(c.charCodeAt(0) - 0x2080));
  if (!texto) throw new ErroDeQuimica("vazio");
  if (/[+\-−⁺⁻]$|\^/.test(texto)) throw new ErroDeQuimica("carga");
  const total: Contagem = new Map();
  for (const parte of texto.split(/[·.*•]/)) {
    if (!parte) throw new ErroDeQuimica("simbolo");
    // Coeficiente do hidrato: 5H2O.
    const coef = /^(\d+)/.exec(parte);
    const resto = coef ? parte.slice(coef[1].length) : parte;
    somar(total, grupo(resto, existe), coef ? Number(coef[1]) : 1);
  }
  return total;
}

function grupo(texto: string, existe: (s: string) => boolean): Contagem {
  const pilha: Contagem[] = [new Map()];
  const fechar: string[] = [];
  let i = 0;
  const numero = () => {
    const m = /^\d+/.exec(texto.slice(i));
    if (!m) return 1;
    i += m[0].length;
    return Number(m[0]);
  };
  while (i < texto.length) {
    const c = texto[i];
    if (c === "(" || c === "[") {
      pilha.push(new Map());
      fechar.push(c === "(" ? ")" : "]");
      i++;
    } else if (c === ")" || c === "]") {
      if (fechar.pop() !== c || pilha.length < 2) throw new ErroDeQuimica("parentese");
      i++;
      const dentro = pilha.pop()!;
      somar(pilha[pilha.length - 1], dentro, numero());
    } else if (/[A-Z]/.test(c)) {
      const m = /^[A-Z][a-z]?/.exec(texto.slice(i))!;
      // "Co" é cobalto; "CO" é carbono e oxigênio. Se o par de letras não for elemento, tenta só a maiúscula.
      let simbolo = m[0];
      if (simbolo.length === 2 && !existe(simbolo)) simbolo = c;
      if (!existe(simbolo)) throw new ErroDeQuimica("elemento", simbolo);
      i += simbolo.length;
      const atual = pilha[pilha.length - 1];
      atual.set(simbolo, (atual.get(simbolo) ?? 0) + numero());
    } else {
      throw new ErroDeQuimica("simbolo", c);
    }
  }
  if (pilha.length !== 1) throw new ErroDeQuimica("parentese");
  return pilha[0];
}

export interface Elemento {
  s: string;
  m: string;
}

export interface MassaMolar {
  total: number;
  partes: { simbolo: string; quantidade: number; massa: number; subtotal: number; porcento: number }[];
}

/** Massa molar (g/mol) e a composição percentual em massa, elemento por elemento. */
export function massaMolar(formula: string, tabela: Elemento[]): MassaMolar {
  const massas = new Map(tabela.map((e) => [e.s, Number(e.m.replace(/[[\]()]/g, ""))]));
  const contagem = lerFormula(formula, (s) => massas.has(s));
  const partes = [...contagem].map(([simbolo, quantidade]) => {
    const massa = massas.get(simbolo)!;
    return { simbolo, quantidade, massa, subtotal: massa * quantidade, porcento: 0 };
  });
  const total = partes.reduce((s, p) => s + p.subtotal, 0);
  for (const p of partes) p.porcento = (p.subtotal / total) * 100;
  return { total, partes };
}

// ───────────── Balanceamento ─────────────

type F = [bigint, bigint];
const Z = BigInt(0);
const UM = BigInt(1);
const mdc = (a: bigint, b: bigint): bigint => {
  a = a < Z ? -a : a;
  b = b < Z ? -b : b;
  while (b !== Z) [a, b] = [b, a % b];
  return a;
};
const fr = (n: bigint, d: bigint = UM): F => {
  if (d < Z) [n, d] = [-n, -d];
  const g = mdc(n, d) || UM;
  return [n / g, d / g];
};
const fSub = (a: F, b: F) => fr(a[0] * b[1] - b[0] * a[1], a[1] * b[1]);
const fMul = (a: F, b: F) => fr(a[0] * b[0], a[1] * b[1]);
const fDiv = (a: F, b: F) => fr(a[0] * b[1], a[1] * b[0]);

export interface Balanceamento {
  reagentes: { formula: string; coeficiente: number }[];
  produtos: { formula: string; coeficiente: number }[];
  /** Átomo por átomo: quantos de cada lado depois de balancear (sempre iguais). */
  conferencia: { simbolo: string; esquerda: number; direita: number }[];
}

/**
 * Balanceia "H2 + O2 -> H2O" (a seta pode ser →, -> ou =). Monta uma equação por elemento (os átomos de cada um se
 * conservam) e acha a única solução de coeficientes inteiros positivos e mínimos. Sem solução, ou com mais de uma
 * independente, avisa em vez de inventar.
 */
export function balancear(equacao: string, existe: (s: string) => boolean): Balanceamento {
  const lados = equacao.split(/→|->|⟶|=/);
  if (lados.length !== 2) throw new ErroDeQuimica("seta");
  const [esq, dir] = lados.map((lado) =>
    lado
      .split("+")
      .map((f) => f.trim())
      .filter(Boolean),
  );
  if (esq.length === 0 || dir.length === 0) throw new ErroDeQuimica("lado");
  // Coeficiente que a pessoa já tenha escrito ("2H2O") é ignorado: o balanceamento acha os certos.
  const formulas = [...esq, ...dir].map((f) => f.replace(/^\d+(?=[A-Z([])/, ""));
  const contagens = formulas.map((f) => lerFormula(f, existe));
  const elementos = [...new Set(contagens.flatMap((c) => [...c.keys()]))];
  // Matriz: uma linha por elemento, uma coluna por substância (produtos com sinal trocado).
  const linhas: F[][] = elementos.map((el) => contagens.map((c, j) => fr(BigInt((c.get(el) ?? 0) * (j < esq.length ? 1 : -1)))));
  const colunas = formulas.length;
  // Escalonamento (Gauss-Jordan) com frações exatas.
  const pivos: number[] = [];
  let linha = 0;
  for (let col = 0; col < colunas && linha < linhas.length; col++) {
    const achada = linhas.findIndex((l, i) => i >= linha && l[col][0] !== Z);
    if (achada < 0) continue;
    [linhas[linha], linhas[achada]] = [linhas[achada], linhas[linha]];
    const piv = linhas[linha][col];
    linhas[linha] = linhas[linha].map((v) => fDiv(v, piv));
    for (let i = 0; i < linhas.length; i++) {
      if (i === linha || linhas[i][col][0] === Z) continue;
      const fator = linhas[i][col];
      linhas[i] = linhas[i].map((v, j) => fSub(v, fMul(fator, linhas[linha][j])));
    }
    pivos.push(col);
    linha++;
  }
  const livres = [...Array(colunas).keys()].filter((c) => !pivos.includes(c));
  if (livres.length === 0) throw new ErroDeQuimica("sem_solucao");
  if (livres.length > 1) throw new ErroDeQuimica("varias_solucoes");
  // A coluna livre vale 1; cada pivô vale menos o número que ficou na coluna livre.
  const livre = livres[0];
  const solucao: F[] = Array.from({ length: colunas }, () => fr(Z));
  solucao[livre] = fr(UM);
  pivos.forEach((col, i) => {
    solucao[col] = fr(-linhas[i][livre][0], linhas[i][livre][1]);
  });
  const mmc = solucao.reduce((m, [, d]) => (m * d) / mdc(m, d), UM);
  let inteiros = solucao.map(([n, d]) => (n * mmc) / d);
  const g = inteiros.reduce((a, b) => mdc(a, b), Z) || UM;
  inteiros = inteiros.map((v) => v / g);
  if (inteiros.every((v) => v < Z)) inteiros = inteiros.map((v) => -v);
  // Coeficiente zero ou de sinal trocado: a reação, do jeito que foi escrita, não fecha.
  if (inteiros.some((v) => v <= Z)) throw new ErroDeQuimica("sem_solucao");
  const coef = inteiros.map(Number);
  const conferencia = elementos.map((simbolo) => ({
    simbolo,
    esquerda: esq.reduce((s, _, j) => s + coef[j] * (contagens[j].get(simbolo) ?? 0), 0),
    direita: dir.reduce((s, _, k) => s + coef[esq.length + k] * (contagens[esq.length + k].get(simbolo) ?? 0), 0),
  }));
  if (conferencia.some((c) => c.esquerda !== c.direita)) throw new ErroDeQuimica("sem_solucao");
  return {
    reagentes: esq.map((_, j) => ({ formula: formulas[j], coeficiente: coef[j] })),
    produtos: dir.map((_, k) => ({ formula: formulas[esq.length + k], coeficiente: coef[esq.length + k] })),
    conferencia,
  };
}

/** Escreve a equação balanceada: 2H2 + O2 → 2H2O (coeficiente 1 não aparece). */
export function escreverEquacao(b: Balanceamento): string {
  const lado = (itens: { formula: string; coeficiente: number }[]) => itens.map((i) => `${i.coeficiente === 1 ? "" : i.coeficiente}${i.formula}`).join(" + ");
  return `${lado(b.reagentes)} → ${lado(b.produtos)}`;
}
