// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As contas das ferramentas menores: sistema solar, escala cartográfica, frequência cardíaca, cores e contraste,
// mais-valia e a contagem da folha de redação. Cada dado de referência traz a fonte, que a tela também mostra.

// ───────────── Sistema solar ─────────────

/**
 * NASA, Planetary Fact Sheet (nssdc.gsfc.nasa.gov/planetary/factsheet): diâmetro equatorial (km), gravidade na
 * superfície (m/s²) e distância média ao Sol (milhões de km). A Lua tem a distância à Terra; Plutão é planeta-anão.
 */
export const corpos = [
  { id: "mercurio", diametro: 4879, gravidade: 3.7, distancia: 57.9 },
  { id: "venus", diametro: 12104, gravidade: 8.9, distancia: 108.2 },
  { id: "terra", diametro: 12756, gravidade: 9.8, distancia: 149.6 },
  { id: "lua", diametro: 3475, gravidade: 1.6, distancia: 0.384 },
  { id: "marte", diametro: 6792, gravidade: 3.7, distancia: 228.0 },
  { id: "jupiter", diametro: 142984, gravidade: 23.1, distancia: 778.5 },
  { id: "saturno", diametro: 120536, gravidade: 9.0, distancia: 1432.0 },
  { id: "urano", diametro: 51118, gravidade: 8.7, distancia: 2867.0 },
  { id: "netuno", diametro: 49528, gravidade: 11.0, distancia: 4515.0 },
  { id: "plutao", diametro: 2376, gravidade: 0.7, distancia: 5906.4 },
] as const;

/** Velocidade da luz no vácuo, exata por definição (km/s). */
export const LUZ = 299792.458;

/** Quanto a balança mostraria lá: a mesma massa, puxada por outra gravidade. */
export const pesoEm = (kgNaTerra: number, gravidade: number) => (kgNaTerra * gravidade) / 9.8;

/** Quanto tempo a luz leva para percorrer a distância (milhões de km), em segundos. */
export const tempoDaLuz = (milhoesDeKm: number) => (milhoesDeKm * 1e6) / LUZ;

// ───────────── Escala cartográfica ─────────────

const NO_CM: Record<string, number> = { mm: 0.1, cm: 1, m: 100, km: 100000 };

/** Da medida no mapa para a medida real: na escala 1:N, 1 cm no mapa são N cm no terreno. */
export function mapaParaReal(medida: number, unidadeMapa: string, escala: number, unidadeReal: string): number {
  if (!(escala > 0) || !NO_CM[unidadeMapa] || !NO_CM[unidadeReal]) throw new RangeError("escala");
  return (medida * NO_CM[unidadeMapa] * escala) / NO_CM[unidadeReal];
}

export function realParaMapa(medida: number, unidadeReal: string, escala: number, unidadeMapa: string): number {
  if (!(escala > 0) || !NO_CM[unidadeMapa] || !NO_CM[unidadeReal]) throw new RangeError("escala");
  return (medida * NO_CM[unidadeReal]) / escala / NO_CM[unidadeMapa];
}

/** Descobre a escala: quantas vezes a medida real é maior que a do mapa (as duas convertidas para centímetros). */
export function acharEscala(noMapa: number, unidadeMapa: string, real: number, unidadeReal: string): number {
  if (!(noMapa > 0) || !(real > 0) || !NO_CM[unidadeMapa] || !NO_CM[unidadeReal]) throw new RangeError("escala");
  return (real * NO_CM[unidadeReal]) / (noMapa * NO_CM[unidadeMapa]);
}

// ───────────── Frequência cardíaca ─────────────

/**
 * Frequência cardíaca máxima estimada pela fórmula de Tanaka, Monahan e Seals (J Am Coll Cardiol, 2001): 208 − 0,7 ×
 * idade. É uma estimativa para grupos de pessoas; a de cada uma pode variar uns 10 batimentos para cima ou para baixo.
 */
export const fcMaxima = (idade: number) => {
  if (!(idade >= 10 && idade <= 100)) throw new RangeError("idade");
  return 208 - 0.7 * idade;
};

/** A fórmula mais antiga e mais conhecida (220 − idade), que a American Heart Association ainda cita: a tela mostra as duas. */
export const fcMaximaAntiga = (idade: number) => {
  if (!(idade >= 10 && idade <= 100)) throw new RangeError("idade");
  return 220 - idade;
};

/** Faixas de esforço em porcentagem da frequência máxima, como a American Heart Association recomenda: moderado 50–70%, vigoroso 70–85%. */
export const faixas = [
  { id: "moderado", de: 0.5, ate: 0.7 },
  { id: "vigoroso", de: 0.7, ate: 0.85 },
] as const;

// ───────────── Cores ─────────────

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function lerHex(texto: string): Rgb {
  const t = texto.trim().replace(/^#/, "");
  const cheio = /^[0-9a-f]{3}$/i.test(t) ? [...t].map((c) => c + c).join("") : t;
  if (!/^[0-9a-f]{6}$/i.test(cheio)) throw new RangeError("cor");
  return { r: parseInt(cheio.slice(0, 2), 16), g: parseInt(cheio.slice(2, 4), 16), b: parseInt(cheio.slice(4, 6), 16) };
}

export const paraHex = ({ r, g, b }: Rgb) => `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;

/** RGB para HSL (matiz em graus, saturação e luminosidade em %). */
export function paraHsl({ r, g, b }: Rgb): { h: number; s: number; l: number } {
  const [rr, gg, bb] = [r / 255, g / 255, b / 255];
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === rr ? (gg - bb) / d + (gg < bb ? 6 : 0) : max === gg ? (bb - rr) / d + 2 : (rr - gg) / d + 4;
  return { h: Math.round(h * 60) % 360, s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function deHsl(h: number, s: number, l: number): Rgb {
  const ss = s / 100;
  const ll = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = ss * Math.min(ll, 1 - ll);
  const f = (n: number) => ll - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255) };
}

/** Harmonias: girar a matiz na roda de cores mantendo saturação e luminosidade. */
export function harmonias(cor: Rgb): Record<"complementar" | "analogas" | "triade", string[]> {
  const { h, s, l } = paraHsl(cor);
  const girar = (graus: number) => paraHex(deHsl((h + graus + 360) % 360, s, l));
  return { complementar: [girar(180)], analogas: [girar(-30), girar(30)], triade: [girar(120), girar(240)] };
}

/** Luminância relativa da WCAG 2 (sRGB linearizado). */
export function luminancia({ r, g, b }: Rgb): number {
  const canal = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

/** Contraste entre duas cores, de 1 a 21. A WCAG pede 4,5 para texto comum e 3 para texto grande (nível AA). */
export function contraste(a: Rgb, b: Rgb): number {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

// ───────────── Mais-valia ─────────────

export interface MaisValia {
  excedente: number;
  valorPorHora: number;
  valorNovo: number;
  maisValia: number;
  taxa: number;
}

/**
 * O exemplo de Marx (O Capital, Livro I, cap. 7, "A taxa da mais-valia"): numa jornada, uma parte do tempo (o trabalho
 * necessário) produz o equivalente ao salário; o resto (o trabalho excedente) produz valor que fica com o capitalista.
 * A taxa de mais-valia é m/v = trabalho excedente ÷ trabalho necessário. Aqui se supõe, como no exemplo do livro, que
 * cada hora produz o mesmo valor novo.
 */
export function maisValia(jornada: number, necessario: number, salario: number): MaisValia {
  if (!(jornada > 0) || !(necessario > 0) || necessario > jornada || !(salario > 0)) throw new RangeError("jornada");
  const valorPorHora = salario / necessario;
  const valorNovo = valorPorHora * jornada;
  const excedente = jornada - necessario;
  const mv = valorNovo - salario;
  return { excedente, valorPorHora, valorNovo, maisValia: mv, taxa: mv / salario };
}

// ───────────── Folha de redação ─────────────

export interface ContagemDeTexto {
  palavras: number;
  caracteres: number;
  semEspacos: number;
  paragrafos: number;
  /** Linhas estimadas: cada parágrafo começa numa linha nova, e cada linha cabe `porLinha` caracteres. */
  linhas: number;
}

/** Conta palavras, caracteres, parágrafos e estima as linhas manuscritas (a largura da letra muda de pessoa para pessoa). */
export function contarTexto(texto: string, porLinha: number): ContagemDeTexto {
  const paragrafos = texto
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const palavras = texto.trim() ? texto.trim().split(/\s+/).length : 0;
  const largura = Math.max(20, Math.min(120, Math.round(porLinha)));
  return {
    palavras,
    caracteres: texto.length,
    semEspacos: texto.replace(/\s/g, "").length,
    paragrafos: paragrafos.length,
    // O recuo do parágrafo ocupa uns 4 caracteres.
    linhas: paragrafos.reduce((soma, p) => soma + Math.max(1, Math.ceil((p.length + 4) / largura)), 0),
  };
}
