// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O resolvedor passo a passo: a alternativa livre a aplicativos fechados como o Photomath. Resolve expressões com
// frações (sem arredondar), porcentagem, regra de três, equações do 1º e do 2º grau e sistemas 2×2, explicando
// cada passagem como no caderno. Cada passo é um código com valores; a tela monta o texto no idioma da pessoa.
// Lógica pura, sem React: `npm run testar:ferramentas` confere as contas.
import { ExprError, parse, type Node } from "../expressao";

const Z = BigInt(0);
const UM = BigInt(1);
const DEZ = BigInt(10);

/** Fração "crua": não se simplifica sozinha, para o passo de simplificar aparecer na tela. O denominador é sempre positivo. */
export interface Q {
  n: bigint;
  d: bigint;
}

const babs = (v: bigint) => (v < Z ? -v : v);
export function mdc(a: bigint, b: bigint): bigint {
  a = babs(a);
  b = babs(b);
  while (b !== Z) [a, b] = [b, a % b];
  return a;
}
export const mmc = (a: bigint, b: bigint) => (a === Z || b === Z ? Z : babs((a / mdc(a, b)) * b));
const q = (n: bigint | number, d: bigint | number = 1): Q => {
  let nn = typeof n === "bigint" ? n : BigInt(n);
  let dd = typeof d === "bigint" ? d : BigInt(d);
  if (dd === Z) throw new ResolverError("divisao");
  if (dd < Z) {
    nn = -nn;
    dd = -dd;
  }
  return { n: nn, d: dd };
};
const reduz = (a: Q): Q => {
  const g = mdc(a.n, a.d) || UM;
  return { n: a.n / g, d: a.d / g };
};
const soma = (a: Q, b: Q) => reduz(q(a.n * b.d + b.n * a.d, a.d * b.d));
const sub = (a: Q, b: Q) => reduz(q(a.n * b.d - b.n * a.d, a.d * b.d));
const mul = (a: Q, b: Q) => reduz(q(a.n * b.n, a.d * b.d));
const div = (a: Q, b: Q) => {
  if (b.n === Z) throw new ResolverError("divisao");
  return reduz(q(a.n * b.d, a.d * b.n));
};
const zero = (a: Q) => a.n === Z;
const inteiro = (a: Q) => a.d === UM;
const negativo = (a: Q) => a.n < Z;
const oposto = (a: Q): Q => ({ n: -a.n, d: a.d });
export const valor = (a: Q) => Number(a.n) / Number(a.d);

export type CodigoDeErro = "vazio" | "leitura" | "divisao" | "nao_suportado" | "grau" | "variavel" | "sistema" | "numero";
export class ResolverError extends Error {
  codigo: CodigoDeErro;
  constructor(codigo: CodigoDeErro) {
    super(codigo);
    this.codigo = codigo;
  }
}

/** Um passo: o código da explicação, os valores que ela cita e a conta como fica depois dele. */
export interface Passo {
  chave: string;
  valores?: Record<string, string>;
  conta?: string;
}

export interface Resolucao {
  tipo: "expressao" | "equacao1" | "equacao2" | "identidade" | "impossivel" | "sistema" | "porcentagem" | "regra";
  passos: Passo[];
  /** As respostas, já escritas (fração, raiz ou decimal). */
  respostas: string[];
  /** As mesmas respostas em decimal, quando são números reais. */
  aproximadas: number[];
}

// ───────────── Escrita ─────────────

/** Como escrever números: o separador decimal do idioma. */
export interface Formato {
  decimal: string;
}
const formatoPadrao: Formato = { decimal: "," };

export function fracao(a: Q, f: Formato = formatoPadrao): string {
  void f;
  const corpo = a.d === UM ? `${babs(a.n)}` : `${babs(a.n)}/${a.d}`;
  return a.n < Z ? `−${corpo}` : corpo;
}

export function decimal(v: number, f: Formato = formatoPadrao, casas = 6): string {
  if (!Number.isFinite(v)) return "?";
  const r = Number(v.toFixed(casas));
  if (r === 0) return "0";
  const texto = Math.abs(r) >= 1e12 ? r.toExponential(6) : r.toFixed(casas).replace(/\.?0+$/, "");
  return texto.replace("-", "−").replace(".", f.decimal);
}

/** Lê um número digitado num campo: aceita vírgula ou ponto e frações "3/4". */
export function lerNumero(texto: string): Q {
  const t = texto.trim().replace(/\s+/g, "").replace("−", "-");
  const fr = /^(-)?(\d+)\/(\d+)$/.exec(t);
  if (fr) {
    if (fr[3] === "0" || /^0+$/.test(fr[3])) throw new ResolverError("divisao");
    return q(BigInt((fr[1] ?? "") + fr[2]), BigInt(fr[3]));
  }
  const m = /^(-)?(\d*)(?:[.,](\d+))?$/.exec(t);
  if (!m || (!m[2] && !m[3])) throw new ResolverError("numero");
  const casas = m[3] ?? "";
  const r = q(BigInt((m[2] || "0") + casas), DEZ ** BigInt(casas.length));
  return m[1] ? oposto(r) : r;
}

// ───────────── Expressões com frações ─────────────

type T = { k: "num"; v: Q } | { k: "op"; op: "+" | "-" | "*" | "/" | "^"; a: T; b: T };

const PRECEDENCIA = { "+": 1, "-": 1, "*": 2, "/": 2, "^": 3 } as const;
const SIMBOLO = { "+": "+", "-": "−", "*": "×", "/": "÷", "^": "^" } as const;

/** Converte a árvore do analisador para a das frações: "3/4" entre dois inteiros vira uma fração só. */
function paraFracoes(no: Node): T {
  switch (no.kind) {
    case "number": {
      const r = lerNumero(no.text);
      return { k: "num", v: r };
    }
    case "negative": {
      const dentro = paraFracoes(no.inner);
      return dentro.k === "num" ? { k: "num", v: oposto(dentro.v) } : { k: "op", op: "*", a: { k: "num", v: q(-1) }, b: dentro };
    }
    case "percent":
      return { k: "op", op: "/", a: paraFracoes(no.inner), b: { k: "num", v: q(100) } };
    case "binary": {
      const a = paraFracoes(no.left);
      const b = paraFracoes(no.right);
      const literal = no.left.kind === "number" || (no.left.kind === "negative" && no.left.inner.kind === "number");
      if (no.op === "/" && a.k === "num" && b.k === "num" && inteiro(a.v) && inteiro(b.v) && !negativo(b.v) && literal && no.right.kind === "number") {
        if (b.v.n === Z) throw new ResolverError("divisao");
        return { k: "num", v: q(a.v.n, b.v.n) };
      }
      return { k: "op", op: no.op, a, b };
    }
    default:
      throw new ResolverError("nao_suportado");
  }
}

function escrever(t: T, pai = 0, direita = false): string {
  if (t.k === "num") {
    const texto = fracao(t.v);
    // Fração ou negativo no meio da conta vai entre parênteses: 2 × (−3), 1/2 ÷ (3/4).
    return pai > 0 && (negativo(t.v) || (!inteiro(t.v) && pai >= 2)) ? `(${texto})` : texto;
  }
  const p = PRECEDENCIA[t.op];
  const texto = `${escrever(t.a, p)} ${SIMBOLO[t.op]} ${escrever(t.b, p, true)}`;
  return p < pai || (p === pai && direita && t.op !== "+" && t.op !== "*") || (t.op === "^" && pai === 3 && !direita) ? `(${texto})` : texto;
}

/** O primeiro pedaço que dá para resolver agora: a operação mais à esquerda com dois números prontos. */
function reduzivel(t: T): (T & { k: "op" }) | null {
  if (t.k === "num") return null;
  return reduzivel(t.a) ?? reduzivel(t.b) ?? (t.a.k === "num" && t.b.k === "num" ? t : null);
}

function trocar(t: T, alvo: T, novo: T): T {
  if (t === alvo) return novo;
  if (t.k === "num") return t;
  return { ...t, a: trocar(t.a, alvo, novo), b: trocar(t.b, alvo, novo) };
}

/** Resolve uma operação entre dois números e devolve o que ela vira, com a explicação. Pode levar mais de uma rodada (MMC). */
function resolverUma(no: T & { k: "op" }, passos: Passo[], raiz: T): T {
  const a = (no.a as { v: Q }).v;
  const b = (no.b as { v: Q }).v;
  const num = (v: Q): T => ({ k: "num", v });
  const registrar = (chave: string, novo: T, valores: Record<string, string> = {}) => {
    passos.push({ chave, valores, conta: escrever(trocar(raiz, no, novo)) });
    return novo;
  };
  switch (no.op) {
    case "+":
    case "-": {
      if (a.d !== b.d) {
        // Denominadores diferentes: primeiro tudo no mesmo denominador, pelo MMC.
        const m = mmc(a.d, b.d);
        const a2 = q(a.n * (m / a.d), m);
        const b2 = q(b.n * (m / b.d), m);
        const novo: T = { k: "op", op: no.op, a: num(a2), b: num(b2) };
        passos.push({ chave: "mmc", valores: { a: `${a.d}`, b: `${b.d}`, m: `${m}` }, conta: escrever(trocar(raiz, no, novo)) });
        return novo;
      }
      const r = q(no.op === "+" ? a.n + b.n : a.n - b.n, a.d);
      return registrar(a.d === UM ? (no.op === "+" ? "somar" : "subtrair") : no.op === "+" ? "somar_fracoes" : "subtrair_fracoes", num(r), { d: `${a.d}` });
    }
    case "*": {
      const r = q(a.n * b.n, a.d * b.d);
      return registrar(inteiro(a) && inteiro(b) ? "multiplicar" : "multiplicar_fracoes", num(r));
    }
    case "/": {
      if (zero(b)) throw new ResolverError("divisao");
      if (inteiro(a) && inteiro(b)) return registrar("dividir", num(q(a.n, b.n)));
      // Dividir por uma fração é multiplicar pela inversa dela.
      const inversa = q(b.d, b.n);
      const novo: T = { k: "op", op: "*", a: num(a), b: num(inversa) };
      passos.push({ chave: "inversa", valores: { f: fracao(b), i: fracao(inversa) }, conta: escrever(trocar(raiz, no, novo)) });
      return novo;
    }
    case "^": {
      if (!inteiro(b)) throw new ResolverError("nao_suportado");
      const e = b.n;
      if (babs(e) > BigInt(64)) throw new ResolverError("nao_suportado");
      if (zero(a) && e <= Z) throw new ResolverError("divisao");
      const base = e < Z ? q(a.d, a.n) : a;
      const ee = babs(e);
      const r = q(base.n ** ee, base.d ** ee);
      return registrar(e < Z ? "potencia_negativa" : "potencia", num(r), { e: `${e}` });
    }
  }
}

/** Resolve uma expressão numérica com frações, passo a passo, sem arredondar nada. */
export function resolverExpressao(texto: string): Resolucao {
  if (!texto.trim()) throw new ResolverError("vazio");
  let arvore: T;
  try {
    // No caderno, "3/4" é uma fração só, escrita uma em cima da outra: "1/2 ÷ 3/4" é (1/2) ÷ (3/4). Para dividir, usa-se ÷.
    const comFracoes = texto.replace(/(?<![\d.,)^])(\d+)\s*\/\s*(\d+)(?![\d.,(^])/g, "($1/$2)");
    arvore = paraFracoes(parse(comFracoes));
  } catch (erro) {
    if (erro instanceof ResolverError) throw erro;
    if (erro instanceof ExprError) throw new ResolverError("leitura");
    throw erro;
  }
  const passos: Passo[] = [{ chave: "expressao", conta: escrever(arvore) }];
  let guarda = 0;
  for (let no = reduzivel(arvore); no; no = reduzivel(arvore)) {
    if (++guarda > 200) throw new ResolverError("nao_suportado");
    const novo = resolverUma(no, passos, arvore);
    arvore = trocar(arvore, no, novo);
    // Depois de cada conta, a fração que dá para simplificar é simplificada na hora, num passo à parte.
    if (novo.k === "num") {
      const r = reduz(novo.v);
      if (r.n !== novo.v.n || r.d !== novo.v.d) {
        const g = mdc(novo.v.n, novo.v.d);
        const simplificado: T = { k: "num", v: r };
        arvore = trocar(arvore, novo, simplificado);
        passos.push({ chave: "simplificar", valores: { g: `${g}`, de: fracao(novo.v), para: fracao(r) }, conta: escrever(arvore) });
      }
    }
  }
  const final = (arvore as { v: Q }).v;
  const respostas = [fracao(final)];
  if (!inteiro(final)) {
    passos.push({ chave: "em_decimal", valores: { valor: decimal(valor(final)) } });
    // Fração imprópria também vira número misto: 7/2 = 3 e 1/2.
    if (babs(final.n) > final.d) {
      const parte = babs(final.n) / final.d;
      const resto = babs(final.n) % final.d;
      passos.push({ chave: "misto", valores: { inteiro: `${negativo(final) ? "−" : ""}${parte}`, fracao: `${resto}/${final.d}` } });
    }
  }
  return { tipo: "expressao", passos, respostas, aproximadas: [valor(final)] };
}

// ───────────── Polinômios (equações) ─────────────

/** Polinômio de uma ou duas variáveis com coeficientes exatos: "x" → 1, "x^2" → 1, "y" → 1, "" (número) → … */
type Poli = Map<string, Q>;

const monomio = (x: number, y: number) => `${x},${y}`;
const grauDe = (chave: string) => chave.split(",").map(Number) as [number, number];

function poliSoma(a: Poli, b: Poli, sinal = 1): Poli {
  const r: Poli = new Map(a);
  for (const [k, v] of b) {
    const atual = r.get(k) ?? q(0);
    const novo = sinal > 0 ? soma(atual, v) : sub(atual, v);
    if (zero(novo)) r.delete(k);
    else r.set(k, novo);
  }
  return r;
}
function poliMul(a: Poli, b: Poli): Poli {
  let r: Poli = new Map();
  for (const [ka, va] of a) {
    for (const [kb, vb] of b) {
      const [xa, ya] = grauDe(ka);
      const [xb, yb] = grauDe(kb);
      r = poliSoma(r, new Map([[monomio(xa + xb, ya + yb), mul(va, vb)]]));
    }
  }
  return r;
}
const grauTotal = (p: Poli) => Math.max(0, ...[...p.keys()].map((k) => grauDe(k)[0] + grauDe(k)[1]));
const constante = (p: Poli) => p.size === 0 || (p.size === 1 && p.has(monomio(0, 0)));

function paraPoli(no: Node): Poli {
  switch (no.kind) {
    case "number": {
      const v = lerNumero(no.text);
      return zero(v) ? new Map() : new Map([[monomio(0, 0), v]]);
    }
    case "variable":
      return new Map([[no.name === "y" ? monomio(0, 1) : monomio(1, 0), q(1)]]);
    case "negative":
      return poliMul(paraPoli(no.inner), new Map([[monomio(0, 0), q(-1)]]));
    case "percent":
      return poliMul(paraPoli(no.inner), new Map([[monomio(0, 0), q(1, 100)]]));
    case "binary": {
      const a = paraPoli(no.left);
      const b = paraPoli(no.right);
      if (no.op === "+") return poliSoma(a, b);
      if (no.op === "-") return poliSoma(a, b, -1);
      if (no.op === "*") {
        const r = poliMul(a, b);
        if (grauTotal(r) > 2) throw new ResolverError("grau");
        return r;
      }
      if (no.op === "/") {
        // Só se divide por número: x no denominador muda o tipo de equação.
        if (!constante(b)) throw new ResolverError("nao_suportado");
        const d = b.get(monomio(0, 0));
        if (!d) throw new ResolverError("divisao");
        return poliMul(a, new Map([[monomio(0, 0), q(d.d, d.n)]]));
      }
      if (!constante(b)) throw new ResolverError("nao_suportado");
      const e = b.get(monomio(0, 0)) ?? q(0);
      if (!inteiro(e) || e.n < Z || e.n > BigInt(2)) throw new ResolverError(e.n > BigInt(2) ? "grau" : "nao_suportado");
      let r: Poli = new Map([[monomio(0, 0), q(1)]]);
      for (let i = Z; i < e.n; i++) r = poliMul(r, a);
      if (grauTotal(r) > 2) throw new ResolverError("grau");
      return r;
    }
    default:
      throw new ResolverError("nao_suportado");
  }
}

/** Escreve um polinômio de uma variável: 2x² − 3x + 1. */
function escreverPoli(p: Poli): string {
  const termos = [...p.entries()]
    .map(([k, v]) => ({ x: grauDe(k)[0], y: grauDe(k)[1], v }))
    .sort((a, b) => b.x + b.y - (a.x + a.y) || b.x - a.x);
  if (termos.length === 0) return "0";
  return termos
    .map(({ x, y, v }, i) => {
      const letras = `${x ? (x === 2 ? "x²" : "x") : ""}${y ? (y === 2 ? "y²" : "y") : ""}`;
      const absoluto = { n: babs(v.n), d: v.d };
      const coef = letras && absoluto.n === UM && absoluto.d === UM ? "" : inteiro(absoluto) || !letras ? fracao(absoluto) : `(${fracao(absoluto)})`;
      const sinal = i === 0 ? (negativo(v) ? "−" : "") : negativo(v) ? " − " : " + ";
      return `${sinal}${coef}${letras}`;
    })
    .join("");
}

const coef = (p: Poli, x: number, y = 0) => p.get(monomio(x, y)) ?? q(0);

/** Raiz de um inteiro em forma simplificada: √72 = 6√2. */
function raizSimplificada(v: bigint): [bigint, bigint] {
  let fora = UM;
  let dentro = v;
  if (v > BigInt(1e12)) return [UM, v];
  for (let p = BigInt(2); p * p <= dentro; p++) {
    while (dentro % (p * p) === Z) {
      dentro /= p * p;
      fora *= p;
    }
  }
  return [fora, dentro];
}

function separarLados(texto: string): [Node, Node] {
  const lados = texto.split("=");
  if (lados.length !== 2 || !lados[0].trim() || !lados[1].trim()) throw new ResolverError("leitura");
  try {
    return [parse(lados[0], { variables: ["x", "y"] }), parse(lados[1], { variables: ["x", "y"] })];
  } catch (erro) {
    if (erro instanceof ExprError) throw new ResolverError("leitura");
    throw erro;
  }
}

/** Resolve uma equação do 1º ou do 2º grau em x. Com `complexas`, mostra as raízes complexas quando Δ < 0. */
export function resolverEquacao(texto: string, opcoes: { complexas?: boolean } = {}): Resolucao {
  if (!texto.trim()) throw new ResolverError("vazio");
  const [esq, dir] = separarLados(texto);
  const pe = paraPoli(esq);
  const pd = paraPoli(dir);
  for (const k of [...pe.keys(), ...pd.keys()]) if (grauDe(k)[1] > 0) throw new ResolverError("variavel");
  const p = poliSoma(pe, pd, -1);
  const grau = grauTotal(p);
  const passos: Passo[] = [{ chave: "equacao", conta: texto.trim().replace(/-/g, "−").replace(/\*/g, "×") }];

  if (grau <= 1) {
    const a1 = coef(pe, 1);
    const b1 = coef(pe, 0);
    const a2 = coef(pd, 1);
    const b2 = coef(pd, 0);
    passos.push({ chave: "organizar", conta: `${escreverPoli(pe)} = ${escreverPoli(pd)}` });
    const a = sub(a1, a2);
    const b = sub(b2, b1);
    if (!zero(a2) || !zero(b1)) {
      // Os termos com x vão para a esquerda e os números para a direita, trocando o sinal ao passar.
      const lado1 = [a1, oposto(a2)].filter((v) => !zero(v)).map((v, i) => termoX(v, i === 0)).join("") || "0";
      const lado2 = [b2, oposto(b1)].filter((v) => !zero(v)).map((v, i) => termoN(v, i === 0)).join("") || "0";
      passos.push({ chave: "transpor", conta: `${lado1} = ${lado2}` });
    }
    if (zero(a)) {
      if (zero(b)) {
        passos.push({ chave: "identidade", conta: "0 = 0" });
        return { tipo: "identidade", passos, respostas: [], aproximadas: [] };
      }
      passos.push({ chave: "impossivel", conta: `0 = ${fracao(b)}` });
      return { tipo: "impossivel", passos, respostas: [], aproximadas: [] };
    }
    passos.push({ chave: "juntar", conta: `${termoX(a, true)} = ${fracao(b)}` });
    const x = div(b, a);
    if (!(a.n === a.d)) passos.push({ chave: "dividir_lados", valores: { a: fracao(a) }, conta: `x = ${fracao(b)} ÷ ${negativo(a) || !inteiro(a) ? `(${fracao(a)})` : fracao(a)}` });
    passos.push({ chave: "resultado", conta: `x = ${fracao(x)}` });
    passos.push({ chave: "conferir", valores: { x: fracao(x) } });
    return { tipo: "equacao1", passos, respostas: [`x = ${fracao(x)}`], aproximadas: [valor(x)] };
  }

  // 2º grau: tudo de um lado, coeficientes inteiros, Δ e Bhaskara.
  passos.push({ chave: "igualar_zero", conta: `${escreverPoli(p)} = 0` });
  let a = coef(p, 2);
  let b = coef(p, 1);
  let c = coef(p, 0);
  const m = [a, b, c].reduce((acc, v) => mmc(acc, v.d), UM);
  if (m !== UM) {
    a = mul(a, q(m));
    b = mul(b, q(m));
    c = mul(c, q(m));
    passos.push({
      chave: "tirar_fracoes",
      valores: { m: `${m}` },
      conta: `${escreverPoli(new Map([[monomio(2, 0), a], [monomio(1, 0), b], [monomio(0, 0), c]].filter(([, v]) => !zero(v as Q)) as [string, Q][]))} = 0`,
    });
  }
  const A = a.n;
  const B = b.n;
  const C = c.n;
  passos.push({ chave: "coeficientes", valores: { a: `${A}`.replace("-", "−"), b: `${B}`.replace("-", "−"), c: `${C}`.replace("-", "−") } });
  const delta = B * B - BigInt(4) * A * C;
  const par = (v: bigint) => (v < Z ? `(${`${v}`.replace("-", "−")})` : `${v}`);
  passos.push({ chave: "delta", conta: `Δ = ${par(B)}² − 4 × ${par(A)} × ${par(C)} = ${`${delta}`.replace("-", "−")}` });
  const dois_a = BigInt(2) * A;
  const menosB = -B;
  if (delta < Z) {
    passos.push({ chave: "delta_negativo" });
    if (!opcoes.complexas) return { tipo: "equacao2", passos, respostas: [], aproximadas: [] };
    const [fora, dentro] = raizSimplificada(-delta);
    const re = reduz(q(menosB, dois_a));
    const im = reduz(q(fora, babs(dois_a)));
    const raiz = dentro === UM ? "" : `√${dentro}`;
    const parteIm = `${im.n === UM && im.d === UM ? "" : inteiro(im) ? `${im.n}` : `${im.n}/${im.d}·`}${raiz || (im.n === UM && im.d === UM ? "1" : "")}i`;
    const r1 = `${zero(re) ? "" : `${fracao(re)} + `}${parteIm}`;
    const r2 = `${zero(re) ? "−" : `${fracao(re)} − `}${parteIm}`;
    passos.push({ chave: "complexas", conta: `x = (${`${menosB}`.replace("-", "−")} ± i√${-delta}) ÷ ${par(dois_a)}` });
    return { tipo: "equacao2", passos, respostas: [`x₁ = ${r1}`, `x₂ = ${r2}`], aproximadas: [] };
  }
  if (delta === Z) {
    const x = reduz(q(menosB, dois_a));
    passos.push({ chave: "raiz_dupla", conta: `x = ${`${menosB}`.replace("-", "−")} ÷ ${par(dois_a)} = ${fracao(x)}` });
    return { tipo: "equacao2", passos, respostas: [`x = ${fracao(x)}`], aproximadas: [valor(x)] };
  }
  passos.push({ chave: "bhaskara", conta: `x = (${`${menosB}`.replace("-", "−")} ± √${delta}) ÷ ${par(dois_a)}` });
  const [fora, dentro] = raizSimplificada(delta);
  if (dentro === UM) {
    // Δ quadrado perfeito: duas raízes racionais exatas.
    const x1 = reduz(q(menosB + fora, dois_a));
    const x2 = reduz(q(menosB - fora, dois_a));
    passos.push({ chave: "raiz_exata", valores: { delta: `${delta}`, raiz: `${fora}` }, conta: `x₁ = (${`${menosB}`.replace("-", "−")} + ${fora}) ÷ ${par(dois_a)} = ${fracao(x1)}  ·  x₂ = (${`${menosB}`.replace("-", "−")} − ${fora}) ÷ ${par(dois_a)} = ${fracao(x2)}` });
    const [r1, r2] = valor(x1) >= valor(x2) ? [x1, x2] : [x2, x1];
    return { tipo: "equacao2", passos, respostas: [`x₁ = ${fracao(r1)}`, `x₂ = ${fracao(r2)}`], aproximadas: [valor(r1), valor(r2)] };
  }
  // Δ não é quadrado perfeito: a raiz fica indicada, simplificada, e a resposta vem também em decimal.
  if (fora !== UM) passos.push({ chave: "simplificar_raiz", valores: { delta: `${delta}`, fora: `${fora}`, dentro: `${dentro}` }, conta: `√${delta} = ${fora}√${dentro}` });
  const g = mdc(mdc(menosB, fora), dois_a) || UM;
  const sinalD = dois_a / g < Z ? -UM : UM;
  const p0 = (menosB / g) * sinalD;
  const k = fora / g;
  const d0 = (dois_a / g) * sinalD;
  const raizTexto = `${k === UM ? "" : k}√${dentro}`;
  const numerador = p0 === Z ? `±${raizTexto}` : `${`${p0}`.replace("-", "−")} ± ${raizTexto}`;
  const exata = d0 === UM ? `x = ${numerador}` : `x = (${numerador}) ÷ ${d0}`;
  if (g !== UM) passos.push({ chave: "simplificar_fracao_raiz", valores: { g: `${g}` }, conta: exata });
  const v1 = (Number(menosB) + Math.sqrt(Number(delta))) / Number(dois_a);
  const v2 = (Number(menosB) - Math.sqrt(Number(delta))) / Number(dois_a);
  const [m1, m2] = v1 >= v2 ? [v1, v2] : [v2, v1];
  passos.push({ chave: "aproximar", valores: { x1: decimal(m1, formatoPadrao, 4), x2: decimal(m2, formatoPadrao, 4) } });
  return { tipo: "equacao2", passos, respostas: [exata.replace("x = ", "x = ")], aproximadas: [m1, m2] };
}

/** "3x" para a esquerda da equação: o coeficiente, sem o 1 sobrando. */
function termoX(v: Q, primeiro: boolean): string {
  const a = { n: babs(v.n), d: v.d };
  const c = a.n === UM && a.d === UM ? "" : inteiro(a) ? `${a.n}` : `(${fracao(a)})`;
  const sinal = primeiro ? (negativo(v) ? "−" : "") : negativo(v) ? " − " : " + ";
  return `${sinal}${c}x`;
}
function termoN(v: Q, primeiro: boolean): string {
  const sinal = primeiro ? (negativo(v) ? "−" : "") : negativo(v) ? " − " : " + ";
  return `${sinal}${fracao({ n: babs(v.n), d: v.d })}`;
}

// ───────────── Sistemas 2×2 ─────────────

interface Linear {
  a: Q;
  b: Q;
  c: Q;
}

function lerLinear(texto: string): Linear {
  const [esq, dir] = separarLados(texto);
  const p = poliSoma(paraPoli(esq), paraPoli(dir), -1);
  for (const k of p.keys()) {
    const [x, y] = grauDe(k);
    if (x + y > 1) throw new ResolverError("grau");
  }
  return { a: coef(p, 1, 0), b: coef(p, 0, 1), c: oposto(coef(p, 0, 0)) };
}

const escreverLinear = (l: Linear) => {
  const x = zero(l.a) ? "" : termoX(l.a, true);
  const y = zero(l.b) ? "" : termoX(l.b, x === "").replace("x", "y");
  return `${x}${y || ""}${!x && !y ? "0" : ""} = ${fracao(l.c)}`;
};

/** Resolve um sistema de duas equações do 1º grau em x e y, pelo método da adição ou da substituição. */
export function resolverSistema(texto: string, metodo: "adicao" | "substituicao" = "adicao"): Resolucao {
  const linhas = texto
    .split(/[\n;]+/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (linhas.length !== 2) throw new ResolverError("sistema");
  const [e1, e2] = linhas.map(lerLinear);
  const passos: Passo[] = [{ chave: "sistema", conta: `${escreverLinear(e1)}   |   ${escreverLinear(e2)}` }];
  const det = sub(mul(e1.a, e2.b), mul(e2.a, e1.b));
  if (zero(det)) {
    // Retas paralelas (impossível) ou a mesma reta (infinitas soluções).
    const dx = sub(mul(e1.c, e2.b), mul(e2.c, e1.b));
    const dy = sub(mul(e1.a, e2.c), mul(e2.a, e1.c));
    const mesma = zero(dx) && zero(dy);
    passos.push({ chave: mesma ? "sistema_indeterminado" : "sistema_impossivel" });
    return { tipo: mesma ? "identidade" : "impossivel", passos, respostas: [], aproximadas: [] };
  }
  const x = div(sub(mul(e1.c, e2.b), mul(e2.c, e1.b)), det);
  const y = div(sub(mul(e1.a, e2.c), mul(e2.a, e1.c)), det);
  if (metodo === "adicao") {
    // Multiplica cada equação para os y ficarem opostos e somar as duas.
    if (zero(e1.b) || zero(e2.b)) {
      const [com, sem] = zero(e1.b) ? [e2, e1] : [e1, e2];
      void com;
      passos.push({ chave: "isolar_direto", conta: `x = ${fracao(div(sem.c, sem.a))}` });
    } else {
      const m = mmc(babs(e1.b.n) * e2.b.d, babs(e2.b.n) * e1.b.d) || UM;
      const f1 = div(q(m), e1.b);
      const f2 = oposto(div(q(m), e2.b));
      const n1 = { a: mul(e1.a, f1), b: mul(e1.b, f1), c: mul(e1.c, f1) };
      const n2 = { a: mul(e2.a, f2), b: mul(e2.b, f2), c: mul(e2.c, f2) };
      passos.push({ chave: "multiplicar_equacoes", valores: { f1: fracao(f1), f2: fracao(f2) }, conta: `${escreverLinear(n1)}   |   ${escreverLinear(n2)}` });
      const s = { a: soma(n1.a, n2.a), b: q(0), c: soma(n1.c, n2.c) };
      passos.push({ chave: "somar_equacoes", conta: escreverLinear(s) });
      passos.push({ chave: "achar_x", conta: `x = ${fracao(s.c)} ÷ ${negativo(s.a) || !inteiro(s.a) ? `(${fracao(s.a)})` : fracao(s.a)} = ${fracao(x)}` });
    }
  } else {
    // Substituição: isola uma letra na equação em que ela está mais simples.
    const usarX = !zero(e1.a);
    const [l, letra] = usarX ? [e1, "x"] : [e1, "y"];
    const outro = usarX ? l.b : l.a;
    const isolado = `${letra} = (${fracao(l.c)}${zero(outro) ? "" : `${negativo(outro) ? " + " : " − "}${fracao({ n: babs(outro.n), d: outro.d })}${usarX ? "y" : "x"}`}) ÷ ${fracao(usarX ? l.a : l.b)}`;
    passos.push({ chave: "isolar", valores: { letra }, conta: isolado });
    passos.push({ chave: "substituir", valores: { letra }, conta: usarX ? `y = ${fracao(y)}` : `x = ${fracao(x)}` });
  }
  passos.push({ chave: "voltar", conta: `x = ${fracao(x)}   ·   y = ${fracao(y)}` });
  passos.push({ chave: "conferir_sistema", valores: { x: fracao(x), y: fracao(y) } });
  return { tipo: "sistema", passos, respostas: [`x = ${fracao(x)}`, `y = ${fracao(y)}`], aproximadas: [valor(x), valor(y)] };
}

// ───────────── Porcentagem e regra de três ─────────────

/** Quanto é p% de v. */
export function porcentagemDe(p: string, v: string): Resolucao {
  const P = lerNumero(p);
  const V = lerNumero(v);
  const r = reduz(mul(mul(P, V), q(1, 100)));
  return {
    tipo: "porcentagem",
    passos: [
      { chave: "pct_ideia", valores: { p: fracao(P) } },
      { chave: "pct_conta", conta: `${fracao(P)} × ${fracao(V)} ÷ 100 = ${fracao(r)}${inteiro(r) ? "" : ` ≈ ${decimal(valor(r))}`}` },
    ],
    respostas: [inteiro(r) ? fracao(r) : decimal(valor(r))],
    aproximadas: [valor(r)],
  };
}

/** a é quantos por cento de b. */
export function quantoPorcento(a: string, b: string): Resolucao {
  const A = lerNumero(a);
  const B = lerNumero(b);
  if (zero(B)) throw new ResolverError("divisao");
  const r = reduz(mul(div(A, B), q(100)));
  return {
    tipo: "porcentagem",
    passos: [
      { chave: "pct_parte", conta: `${fracao(A)} ÷ ${fracao(B)} = ${inteiro(div(A, B)) ? fracao(div(A, B)) : decimal(valor(div(A, B)))}` },
      { chave: "pct_vezes_cem", conta: `${inteiro(div(A, B)) ? fracao(div(A, B)) : decimal(valor(div(A, B)))} × 100 = ${inteiro(r) ? fracao(r) : decimal(valor(r), formatoPadrao, 2)}%` },
    ],
    respostas: [`${inteiro(r) ? fracao(r) : decimal(valor(r), formatoPadrao, 2)}%`],
    aproximadas: [valor(r)],
  };
}

/** Aumento ou desconto de p% sobre v. */
export function variacao(v: string, p: string, aumento: boolean): Resolucao {
  const V = lerNumero(v);
  const P = lerNumero(p);
  const fator = aumento ? soma(q(1), mul(P, q(1, 100))) : sub(q(1), mul(P, q(1, 100)));
  const r = mul(V, fator);
  const parte = mul(mul(V, P), q(1, 100));
  return {
    tipo: "porcentagem",
    passos: [
      { chave: "pct_conta", conta: `${fracao(P)}% de ${fracao(V)} = ${inteiro(parte) ? fracao(parte) : decimal(valor(parte))}` },
      { chave: aumento ? "pct_somar" : "pct_tirar", conta: `${fracao(V)} ${aumento ? "+" : "−"} ${inteiro(parte) ? fracao(parte) : decimal(valor(parte))} = ${inteiro(r) ? fracao(r) : decimal(valor(r))}` },
      { chave: "pct_fator", valores: { fator: decimal(valor(fator)) }, conta: `${fracao(V)} × ${decimal(valor(fator))} = ${inteiro(r) ? fracao(r) : decimal(valor(r))}` },
    ],
    respostas: [inteiro(r) ? fracao(r) : decimal(valor(r))],
    aproximadas: [valor(r)],
  };
}

/** Regra de três simples: a está para b assim como c está para x (direta) ou o contrário (inversa). */
export function regraDeTres(a: string, b: string, c: string, inversa = false): Resolucao {
  const A = lerNumero(a);
  const B = lerNumero(b);
  const C = lerNumero(c);
  if (zero(inversa ? C : A)) throw new ResolverError("divisao");
  const x = inversa ? div(mul(A, B), C) : div(mul(B, C), A);
  const passos: Passo[] = [
    { chave: inversa ? "regra_inversa" : "regra_direta", conta: `${fracao(A)} → ${fracao(B)}   |   ${fracao(C)} → x` },
    inversa
      ? { chave: "regra_produto_inverso", conta: `${fracao(C)} × x = ${fracao(A)} × ${fracao(B)}` }
      : { chave: "regra_produto_cruzado", conta: `${fracao(A)} × x = ${fracao(B)} × ${fracao(C)}` },
    { chave: "regra_isolar", conta: `x = ${inversa ? `${fracao(A)} × ${fracao(B)} ÷ ${fracao(C)}` : `${fracao(B)} × ${fracao(C)} ÷ ${fracao(A)}`} = ${inteiro(x) ? fracao(x) : `${fracao(x)} ≈ ${decimal(valor(x))}`}` },
  ];
  return { tipo: "regra", passos, respostas: [`x = ${inteiro(x) ? fracao(x) : decimal(valor(x))}`], aproximadas: [valor(x)] };
}

/** Escolhe sozinho o que fazer com o texto: com "=" é equação; com duas equações, sistema; sem "=", expressão. */
export function resolver(texto: string, opcoes: { complexas?: boolean; metodo?: "adicao" | "substituicao" } = {}): Resolucao {
  const limpo = texto.trim();
  if (!limpo) throw new ResolverError("vazio");
  const equacoes = limpo.split(/[\n;]+/).filter((l) => l.trim());
  if (equacoes.length === 2 && equacoes.every((l) => l.includes("="))) return resolverSistema(limpo, opcoes.metodo);
  if (limpo.includes("=")) {
    if (/y/i.test(limpo)) throw new ResolverError("variavel");
    return resolverEquacao(limpo, opcoes);
  }
  return resolverExpressao(limpo);
}
