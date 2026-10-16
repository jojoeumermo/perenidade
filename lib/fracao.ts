// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).

// Frações exatas, para o resolvedor e a química mostrarem contas sem arredondamento: 1/3 continua 1/3.
// Numerador e denominador são BigInt, então nada transborda no meio de uma conta comprida.

export interface Fraction {
  n: bigint;
  /** Sempre positivo; a fração fica sempre na forma irredutível. */
  d: bigint;
}

export const ZERO_N = BigInt(0);
export const ONE_N = BigInt(1);
const TEN = BigInt(10);

export const babs = (value: bigint) => (value < ZERO_N ? -value : value);

export function gcd(a: bigint, b: bigint): bigint {
  a = babs(a);
  b = babs(b);
  while (b !== ZERO_N) [a, b] = [b, a % b];
  return a;
}

export const lcm = (a: bigint, b: bigint): bigint => (a === ZERO_N || b === ZERO_N ? ZERO_N : babs((a / gcd(a, b)) * b));

export function frac(n: bigint | number, d: bigint | number = 1): Fraction {
  let num = typeof n === "bigint" ? n : BigInt(n);
  let den = typeof d === "bigint" ? d : BigInt(d);
  if (den === ZERO_N) throw new RangeError("denominador zero");
  if (den < ZERO_N) {
    num = -num;
    den = -den;
  }
  const g = gcd(num, den) || ONE_N;
  return { n: num / g, d: den / g };
}

export const ZERO = frac(0);
export const ONE = frac(1);

export const add = (a: Fraction, b: Fraction) => frac(a.n * b.d + b.n * a.d, a.d * b.d);
export const sub = (a: Fraction, b: Fraction) => frac(a.n * b.d - b.n * a.d, a.d * b.d);
export const mul = (a: Fraction, b: Fraction) => frac(a.n * b.n, a.d * b.d);
export const neg = (a: Fraction): Fraction => ({ n: -a.n, d: a.d });
export function div(a: Fraction, b: Fraction): Fraction {
  if (b.n === ZERO_N) throw new RangeError("divisão por zero");
  return frac(a.n * b.d, a.d * b.n);
}
export function pow(a: Fraction, exponent: number): Fraction {
  if (!Number.isInteger(exponent)) throw new RangeError("expoente");
  if (exponent < 0) return pow(div(ONE, a), -exponent);
  const e = BigInt(exponent);
  return frac(a.n ** e, a.d ** e);
}

export const isZero = (a: Fraction) => a.n === ZERO_N;
export const isInteger = (a: Fraction) => a.d === ONE_N;
export const equals = (a: Fraction, b: Fraction) => a.n === b.n && a.d === b.d;
export const compare = (a: Fraction, b: Fraction) => {
  const diff = a.n * b.d - b.n * a.d;
  return diff > ZERO_N ? 1 : diff < ZERO_N ? -1 : 0;
};
export const sign = (a: Fraction) => (a.n > ZERO_N ? 1 : a.n < ZERO_N ? -1 : 0);
export const toNumber = (a: Fraction) => Number(a.n) / Number(a.d);

/** Fração exata de um número escrito com casas decimais: "0.25" vira 1/4. */
export function fromDecimal(text: string): Fraction {
  const match = /^(-)?(\d*)(?:[.,](\d+))?$/.exec(text.trim());
  if (!match || (!match[2] && !match[3])) throw new RangeError("número");
  const decimals = match[3] ?? "";
  const value = frac(BigInt((match[2] || "0") + decimals), TEN ** BigInt(decimals.length));
  return match[1] ? neg(value) : value;
}

/** Fração exata de um número da máquina que tenha poucas casas (vindo de um campo já lido como número). */
export function fromNumber(value: number): Fraction {
  if (!Number.isFinite(value)) throw new RangeError("número");
  if (Number.isInteger(value)) return frac(BigInt(value));
  const text = value.toPrecision(15).replace(/0+$/, "").replace(/\.$/, "");
  if (/e/i.test(text)) throw new RangeError("número");
  return fromDecimal(text);
}

/** Texto da fração: "3/4", "−5/2", "7". O sinal de menos é o tipográfico. */
export function show(a: Fraction): string {
  const text = a.d === ONE_N ? `${babs(a.n)}` : `${babs(a.n)}/${a.d}`;
  return a.n < ZERO_N ? `−${text}` : text;
}

/** Número decimal com o separador do idioma, com até `digits` casas, sem zeros sobrando no fim. */
export function decimal(value: number, separator: string, digits = 6): string {
  if (!Number.isFinite(value)) return "?";
  const rounded = Number(value.toFixed(digits));
  if (rounded === 0) return "0";
  let text = Math.abs(rounded) >= 1e15 || Math.abs(rounded) < 1e-6 ? rounded.toExponential(6) : rounded.toFixed(digits).replace(/\.?0+$/, "");
  text = text.replace("-", "−").replace(".", separator);
  return text;
}

/** A fração cabe numa dízima finita? (só tem 2 e 5 no denominador) */
export function terminates(a: Fraction): boolean {
  let d = a.d;
  for (const p of [BigInt(2), BigInt(5)]) while (d % p === ZERO_N) d /= p;
  return d === ONE_N;
}

/** Raiz quadrada exata de um inteiro, quando existe. */
export function isqrt(value: bigint): bigint | null {
  if (value < ZERO_N) return null;
  if (value < BigInt(2)) return value;
  let x = BigInt(Math.floor(Math.sqrt(Number(value))));
  // Ajuste fino: o palpite da máquina pode errar por um em números grandes.
  while (x * x > value) x -= ONE_N;
  while ((x + ONE_N) * (x + ONE_N) <= value) x += ONE_N;
  return x * x === value ? x : null;
}

/** Tira da raiz o maior quadrado: √72 = 6√2 devolve [6, 2]. */
export function simplifyRoot(value: bigint): [outside: bigint, inside: bigint] {
  // Número enorme: procurar quadrados demoraria demais; a raiz fica como está.
  if (value > BigInt(1e12)) return [ONE_N, value];
  let outside = ONE_N;
  let inside = value;
  for (let p = BigInt(2); p * p <= inside; p += ONE_N) {
    while (inside % (p * p) === ZERO_N) {
      inside /= p * p;
      outside *= p;
    }
  }
  return [outside, inside];
}
