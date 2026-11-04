// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Vale o Escrito, pacote "mapa": contas puras de geografia (centro de um polígono, caixa, UF pelo código IBGE, pontos dos
// casos). Sem imports de pacote, sem disco, sem "@/": roda direto no Node nos testes. Quem desenha é
// components/vale-o-escrito/Mapa.tsx.

export type Par = [number, number];
export type Anel = Par[];
export type GeometriaPoligonal =
  | { type: "Polygon"; coordinates: Anel[] }
  | { type: "MultiPolygon"; coordinates: Anel[][] };
export type Caixa = [number, number, number, number];

/** Os dois primeiros dígitos do código IBGE são o código da UF. */
export const UF_POR_CODIGO: Record<string, string> = {
  "11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO",
  "21": "MA", "22": "PI", "23": "CE", "24": "RN", "25": "PB", "26": "PE", "27": "AL", "28": "SE", "29": "BA",
  "31": "MG", "32": "ES", "33": "RJ", "35": "SP",
  "41": "PR", "42": "SC", "43": "RS",
  "50": "MS", "51": "MT", "52": "GO", "53": "DF",
};

export const SIGLAS_DE_UF: readonly string[] = Object.values(UF_POR_CODIGO);

/** UF de um município pelo código IBGE (7 dígitos); undefined quando o código não é de município brasileiro. */
export function ufDoMunicipio(codigo: string | undefined): string | undefined {
  if (!codigo || !/^\d{7}$/.test(codigo)) return undefined;
  return UF_POR_CODIGO[codigo.slice(0, 2)];
}

function polis(g: GeometriaPoligonal): Anel[][] {
  return g.type === "Polygon" ? [g.coordinates] : g.coordinates;
}

/** Caixa [oeste, sul, leste, norte] de todos os pontos; undefined se não houver ponto. */
export function caixa(g: GeometriaPoligonal): Caixa | undefined {
  let o = Infinity;
  let s = Infinity;
  let l = -Infinity;
  let n = -Infinity;
  for (const p of polis(g))
    for (const a of p)
      for (const [x, y] of a) {
        if (x < o) o = x;
        if (x > l) l = x;
        if (y < s) s = y;
        if (y > n) n = y;
      }
  return Number.isFinite(o) ? [o, s, l, n] : undefined;
}

/** União das caixas de várias geometrias. */
export function uniaoDeCaixas(caixas: Array<Caixa | undefined>): Caixa | undefined {
  const v = caixas.filter((c): c is Caixa => !!c);
  if (!v.length) return undefined;
  return [
    Math.min(...v.map((c) => c[0])),
    Math.min(...v.map((c) => c[1])),
    Math.max(...v.map((c) => c[2])),
    Math.max(...v.map((c) => c[3])),
  ];
}

function areaEcentro(a: Anel): { area: number; c: Par } {
  let area2 = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < a.length - 1; i++) {
    const [x0, y0] = a[i];
    const [x1, y1] = a[i + 1];
    const f = x0 * y1 - x1 * y0;
    area2 += f;
    cx += (x0 + x1) * f;
    cy += (y0 + y1) * f;
  }
  if (Math.abs(area2) < 1e-12) {
    const x = a.reduce((t, p) => t + p[0], 0) / (a.length || 1);
    const y = a.reduce((t, p) => t + p[1], 0) / (a.length || 1);
    return { area: 0, c: [x, y] };
  }
  return { area: Math.abs(area2) / 2, c: [cx / (3 * area2), cy / (3 * area2)] };
}

/** Centro do maior polígono (pelo anel de fora). Serve para pôr o ponto do caso em cima do município ou da UF. */
export function centro(g: GeometriaPoligonal): Par | undefined {
  let melhor: { area: number; c: Par } | undefined;
  for (const p of polis(g)) {
    const r = p[0] ? areaEcentro(p[0]) : undefined;
    if (r && (!melhor || r.area > melhor.area)) melhor = r;
  }
  return melhor && Number.isFinite(melhor.c[0]) && Number.isFinite(melhor.c[1]) ? melhor.c : undefined;
}

/** O que o mapa precisa saber de cada entrada (montado a partir de Entrada + Dossie). */
export interface CasoNoMapa {
  id: string;
  titulo: string;
  dossie: string;
  cor: "amarelo" | "azul" | "vermelho";
  /** Sigla da UF. */
  uf?: string;
  /** Código IBGE do município (7 dígitos). */
  municipioIbge?: string;
  /** Rótulo escrito da situação jurídica (já no idioma da página). */
  situacao: string;
}

/** Cores neon por tipo (as mesmas do restante do painel). */
export const COR_NEON = { amarelo: "#ffe600", azul: "#00b3ff", vermelho: "#ff2b4f" } as const;

/** UF do caso: o campo uf (ou regiao) ou, se faltar, os dois primeiros dígitos do código do município. */
export const ufDoCaso = (c: Pick<CasoNoMapa, "uf" | "municipioIbge">): string | undefined => c.uf || ufDoMunicipio(c.municipioIbge);

/** Soma de casos por UF e por município. */
export function contarCasos(casos: readonly CasoNoMapa[]): { porUf: Record<string, number>; porMunicipio: Record<string, number> } {
  const porUf: Record<string, number> = {};
  const porMunicipio: Record<string, number> = {};
  for (const c of casos) {
    const uf = ufDoCaso(c);
    if (uf) porUf[uf] = (porUf[uf] ?? 0) + 1;
    if (c.municipioIbge) porMunicipio[c.municipioIbge] = (porMunicipio[c.municipioIbge] ?? 0) + 1;
  }
  return { porUf, porMunicipio };
}

/**
 * Coordenada de cada caso: o centro do município, quando a malha dele já foi lida; senão o centro da UF; senão o caso
 * fica de fora do mapa (continua na lista). Devolve GeoJSON de pontos com a cor do dossiê.
 */
export function pontosDosCasos(casos: readonly CasoNoMapa[], centroUf: Record<string, Par>, centroMunicipio: Record<string, Par>) {
  const features = [];
  for (const c of casos) {
    const uf = ufDoCaso(c);
    const p = (c.municipioIbge && centroMunicipio[c.municipioIbge]) || (uf && centroUf[uf]) || undefined;
    if (!p) continue;
    features.push({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: p },
      properties: { id: c.id, titulo: c.titulo, cor: COR_NEON[c.cor], dossie: c.dossie, situacao: c.situacao },
    });
  }
  return { type: "FeatureCollection" as const, features };
}
