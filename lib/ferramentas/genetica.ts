// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Quadro de Punnett: cruzamentos de um ou dois genes (com segregação independente, 2ª lei de Mendel) e herança ligada
// ao cromossomo X. Letra maiúscula é o alelo dominante; minúscula, o recessivo. Na ligada ao X, escreve-se o alelo
// logo depois do X: XAXa (mulher portadora), XaY (homem afetado).

export class ErroDeGenetica extends Error {
  codigo: "vazio" | "genotipo" | "genes_diferentes" | "muitos_genes" | "sexo";
  constructor(codigo: ErroDeGenetica["codigo"]) {
    super(codigo);
    this.codigo = codigo;
  }
}

export interface Cruzamento {
  tipo: "autossomica" | "ligada_x";
  gametasMae: string[];
  gametasPai: string[];
  /** Linhas: gametas do primeiro genitor; colunas: do segundo. */
  quadro: string[][];
  genotipos: { genotipo: string; vezes: number }[];
  fenotipos: { fenotipo: string; vezes: number }[];
  total: number;
}

/** Junta os dois alelos de um gene na ordem da escrita: o dominante primeiro (Aa, nunca aA). */
const parear = (a: string, b: string) => (a === a.toUpperCase() && b !== b.toUpperCase() ? a + b : b === b.toUpperCase() && a !== a.toUpperCase() ? b + a : [a, b].sort().join(""));

function genesDe(texto: string): string[] {
  const limpo = texto.replace(/\s+/g, "");
  if (!limpo) throw new ErroDeGenetica("vazio");
  if (!/^[A-Za-z]+$/.test(limpo) || limpo.length % 2 !== 0) throw new ErroDeGenetica("genotipo");
  const genes: string[] = [];
  for (let i = 0; i < limpo.length; i += 2) {
    const par = limpo.slice(i, i + 2);
    if (par[0].toLowerCase() !== par[1].toLowerCase()) throw new ErroDeGenetica("genotipo");
    genes.push(par);
  }
  if (genes.length > 2) throw new ErroDeGenetica("muitos_genes");
  return genes;
}

function gametas(genes: string[]): string[] {
  return genes.reduce<string[]>((acc, gene) => acc.flatMap((g) => [g + gene[0], g + gene[1]]), [""]);
}

const contar = (lista: string[]) => {
  const mapa = new Map<string, number>();
  for (const item of lista) mapa.set(item, (mapa.get(item) ?? 0) + 1);
  return [...mapa].map(([chave, vezes]) => ({ chave, vezes })).sort((a, b) => b.vezes - a.vezes || (a.chave < b.chave ? -1 : a.chave > b.chave ? 1 : 0));
};

/** Fenótipo de um gene: "A_" se tem o dominante, "aa" se não. */
const fenotipoDe = (genotipo: string) =>
  (genotipo.match(/../g) ?? [])
    .map((par) => (par[0] === par[0].toUpperCase() || par[1] === par[1].toUpperCase() ? `${par[0].toUpperCase()}_` : par))
    .join("");

/** Cruza dois genótipos autossômicos: "Aa" × "Aa", "AaBb" × "aabb". */
export function cruzarAutossomica(mae: string, pai: string): Cruzamento {
  const gm = genesDe(mae);
  const gp = genesDe(pai);
  if (gm.length !== gp.length || gm.some((g, i) => g[0].toLowerCase() !== gp[i][0].toLowerCase())) throw new ErroDeGenetica("genes_diferentes");
  const gametasMae = gametas(gm);
  const gametasPai = gametas(gp);
  const quadro = gametasMae.map((a) => gametasPai.map((b) => [...a].map((alelo, i) => parear(alelo, b[i])).join("")));
  const todos = quadro.flat();
  return {
    tipo: "autossomica",
    gametasMae,
    gametasPai,
    quadro,
    genotipos: contar(todos).map(({ chave, vezes }) => ({ genotipo: chave, vezes })),
    fenotipos: contar(todos.map(fenotipoDe)).map(({ chave, vezes }) => ({ fenotipo: chave, vezes })),
    total: todos.length,
  };
}

/** Lê "XAXa" (mulher) ou "XaY" (homem) e devolve os cromossomos sexuais com o alelo de cada X. */
function sexuais(texto: string): string[] {
  const limpo = texto.replace(/\s+/g, "").replace(/[ᴬ]/g, "A").replace(/[ᵃ]/g, "a");
  const partes = limpo.match(/X[A-Za-z]|Y/g);
  if (!partes || partes.join("") !== limpo || partes.length !== 2) throw new ErroDeGenetica("genotipo");
  return partes;
}

/** Herança ligada ao X: o primeiro genótipo é da mãe (XX), o segundo do pai (XY). */
export function cruzarLigadaX(mae: string, pai: string): Cruzamento {
  const m = sexuais(mae);
  const p = sexuais(pai);
  if (m.includes("Y") || !p.includes("Y") || p.filter((x) => x === "Y").length !== 1) throw new ErroDeGenetica("sexo");
  const alelo = (x: string) => x[1];
  if ([...m, ...p.filter((x) => x !== "Y")].some((x) => alelo(x).toLowerCase() !== alelo(m[0]).toLowerCase())) throw new ErroDeGenetica("genes_diferentes");
  const quadro = m.map((a) => p.map((b) => (b === "Y" ? `${a}Y` : parear(alelo(a), alelo(b)).replace(/(.)(.)/, "X$1X$2"))));
  const todos = quadro.flat();
  // Fenótipo por sexo: mulher precisa dos dois X recessivos para ser afetada; homem, de um só.
  const fenotipo = (g: string) => {
    const homem = g.endsWith("Y");
    const alelos = g.replace(/[XY]/g, "");
    const afetado = alelos === alelos.toLowerCase();
    const portadora = !homem && !afetado && alelos !== alelos.toUpperCase();
    return `${homem ? "homem" : "mulher"}:${afetado ? "afetado" : portadora ? "portadora" : "normal"}`;
  };
  return {
    tipo: "ligada_x",
    gametasMae: m,
    gametasPai: p,
    quadro,
    genotipos: contar(todos).map(({ chave, vezes }) => ({ genotipo: chave, vezes })),
    fenotipos: contar(todos.map(fenotipo)).map(({ chave, vezes }) => ({ fenotipo: chave, vezes })),
    total: todos.length,
  };
}

/** Escolhe sozinho: com X e Y é herança ligada ao sexo; sem, autossômica. */
export function cruzar(mae: string, pai: string): Cruzamento {
  return /X/.test(mae + pai) ? cruzarLigadaX(mae, pai) : cruzarAutossomica(mae, pai);
}

/** Proporção simplificada: [9, 3, 3, 1] a partir das contagens. */
export function proporcao(vezes: number[]): number[] {
  const mdc = (a: number, b: number): number => (b === 0 ? a : mdc(b, a % b));
  const g = vezes.reduce(mdc, 0) || 1;
  return vezes.map((v) => v / g);
}
