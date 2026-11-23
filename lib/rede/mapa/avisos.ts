// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As regras puras dos avisos de local (Prompt 4, item 4; supabase/migracoes/20261127-p4-avisos-de-local.sql): a grade de cerca de
// 200 m, que o APARELHO aplica antes de enviar (o banco só recebe os dois números inteiros da célula), as áreas de cerca de 2 km
// (10 x 10 células: o que se segue e o que a moderação trava), as categorias fechadas e a limpeza do que vem do banco. Sem os
// atalhos "@/" de propósito (o teste roda no Node).
import { ligado, type Recurso } from "../../recursos";
import { alumia2Ligada } from "../rotas-novas";

/** O interruptor do grupo (lib/recursos.ts, só pelo nome, desligado). */
export const INTERRUPTOR_DOS_AVISOS_DE_LOCAL: Recurso = "alumia-p4-avisos-de-local";

export function avisosDeLocalLigados(): boolean {
  return alumia2Ligada() && ligado(INTERRUPTOR_DOS_AVISOS_DE_LOCAL);
}

/** O lado da célula, em graus: 0,002° dá cerca de 222 m de norte a sul e cerca de 200 m de leste a oeste no Brasil. */
export const PASSO = 0.002;
/** Células por lado de uma área (a área tem cerca de 2 km). */
export const LADO_DA_AREA = 10;
/** As horas que um aviso dura e as que "ainda está lá" acrescenta (uma vez só). */
export const HORAS = 2;
/** Quantos relatos distintos confirmam um aviso. */
export const PARA_CONFIRMAR = 3;

/** As categorias, sempre desta lista: sem texto livre, sem foto. Nenhuma nomeia a polícia. Iguais às do banco (o teste confere). */
export const CATEGORIAS = ["cuidado", "assalto", "obra", "violencia_manifestantes", "rua_bloqueada", "alagamento"] as const;
export type Categoria = (typeof CATEGORIAS)[number];
export const ehCategoria = (c: unknown): c is Categoria => typeof c === "string" && (CATEGORIAS as readonly string[]).includes(c);

/** Os motivos da trava de área (moderação). */
export const MOTIVOS_DA_TRAVA = ["infiltracao", "abuso", "risco", "outro"] as const;
export type MotivoDaTrava = (typeof MOTIVOS_DA_TRAVA)[number];

export interface Celula {
  la: number;
  lo: number;
}
export interface Area {
  ala: number;
  alo: number;
}

const LA_MIN = -45000, LA_MAX = 45000, LO_MIN = -90000, LO_MAX = 90000;

/**
 * A célula de uma posição: é isto, e só isto, que sai do aparelho. A posição de verdade nunca é guardada nem enviada; a conta
 * acontece aqui, antes de qualquer pedido.
 */
export function celulaDe(lat: number, lon: number): Celula | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat >= 90 || lon < -180 || lon >= 180) return null;
  // O épsilon evita que 0,004 / 0,002 = 1,9999… caia na célula de baixo.
  const la = Math.floor(lat / PASSO + 1e-9);
  const lo = Math.floor(lon / PASSO + 1e-9);
  return celulaOk({ la, lo }) ? { la, lo } : null;
}

export function celulaOk(c: Partial<Celula> | null | undefined): c is Celula {
  return !!c && Number.isInteger(c.la) && Number.isInteger(c.lo) && c.la! >= LA_MIN && c.la! < LA_MAX && c.lo! >= LO_MIN && c.lo! < LO_MAX;
}

export function areaOk(a: Partial<Area> | null | undefined): a is Area {
  return !!a && Number.isInteger(a.ala) && Number.isInteger(a.alo) && a.ala! >= LA_MIN / LADO_DA_AREA && a.ala! < LA_MAX / LADO_DA_AREA && a.alo! >= LO_MIN / LADO_DA_AREA && a.alo! < LO_MAX / LADO_DA_AREA;
}

/** A área de uma célula (o mesmo floor do banco: interno.rede_local_area). */
export function areaDe(c: Celula): Area {
  return { ala: Math.floor(c.la / LADO_DA_AREA), alo: Math.floor(c.lo / LADO_DA_AREA) };
}

/**
 * A célula do centro de um município do índice (lib/rede/mapa/municipios.json): o ponto do desenho volta a latitude e longitude pela
 * conta inversa da projeção de scripts/gerar-malha-do-mapa.mjs (equirretangular, com o oeste em 74,008° O, o norte em 5,229° N e
 * cerca de 26,4 unidades por grau). O ponto do índice é o centro de área do município arredondado para um inteiro (~4 km): é só
 * o ponto de partida, e a pessoa anda com as setas até a quadra dela. Nenhuma posição de pessoa entra aqui. Fora da Terra: nula.
 */
export function celulaDoMunicipio(m: { x: number; y: number }): Celula | null {
  if (!Number.isFinite(m.x) || !Number.isFinite(m.y)) return null;
  return celulaDe(5.2294 - 0.037896 * m.y, -74.0084 + 0.039225 * m.x);
}

/** A célula do meio de uma área (para começar o desenho por uma área seguida). */
export function meioDaArea(a: Area): Celula {
  return { la: a.ala * LADO_DA_AREA + LADO_DA_AREA / 2, lo: a.alo * LADO_DA_AREA + LADO_DA_AREA / 2 };
}

export const chaveDaArea = (a: Area): string => `${a.ala}:${a.alo}`;
export const chaveDaCelula = (c: Celula): string => `${c.la}:${c.lo}`;

/** Anda células (setas do desenho): norte aumenta la, leste aumenta lo. */
export function andar(c: Celula, dla: number, dlo: number): Celula {
  const n = { la: c.la + dla, lo: c.lo + dlo };
  return celulaOk(n) ? n : c;
}

/** A distância aproximada (em metros, de 100 em 100) e o rumo de uma célula a outra, de centro a centro. */
export function distanciaERumo(de: Celula, para: Celula): { metros: number; rumo: "aqui" | "n" | "ne" | "l" | "se" | "s" | "so" | "o" | "no" } {
  const latMedia = ((de.la + para.la + 1) / 2) * PASSO;
  const norte = (para.la - de.la) * PASSO * 111_320;
  const leste = (para.lo - de.lo) * PASSO * 111_320 * Math.cos((latMedia * Math.PI) / 180);
  const metros = Math.round(Math.hypot(norte, leste) / 100) * 100;
  if (para.la === de.la && para.lo === de.lo) return { metros: 0, rumo: "aqui" };
  const graus = ((Math.atan2(leste, norte) * 180) / Math.PI + 360) % 360;
  const rumos = ["n", "ne", "l", "se", "s", "so", "o", "no"] as const;
  return { metros, rumo: rumos[Math.round(graus / 45) % 8] };
}

// ───── O que o banco devolve ─────

export interface AvisoDeLocal extends Celula {
  id: string;
  categoria: Categoria;
  /** Três relatos distintos na mesma célula: "relatos confirmados". Nenhum número sai do banco. */
  confirmado: boolean;
  renovado: boolean;
  /** Arredondado para 10 minutos. */
  criado_em: string;
  expira_em: string;
}

export interface TravaDeArea extends Area {
  ate: string;
}

export interface Vizinhanca {
  area: Area;
  avisos: AvisoDeLocal[];
  travadas: TravaDeArea[];
  /** Quem chama é da moderação (pode apagar e travar). */
  modera: boolean;
}

const idOk = (x: unknown): x is string => typeof x === "string" && /^[0-9a-f-]{8,64}$/i.test(x);
const dataOk = (x: unknown): x is string => typeof x === "string" && Number.isFinite(Date.parse(x));

/**
 * Desconfia do banco: só os campos conhecidos (nada de quem avisou, nada de número de relatos), só categoria da lista, só aviso que
 * ainda não venceu (pelo relógio do aparelho).
 */
export function limparVizinhanca(v: Partial<Vizinhanca> | null | undefined, agora = Date.now()): Vizinhanca {
  const area = areaOk(v?.area) ? { ala: v.area.ala, alo: v.area.alo } : { ala: 0, alo: 0 };
  const avisos = (Array.isArray(v?.avisos) ? v.avisos : [])
    .filter((a): a is AvisoDeLocal => !!a && idOk(a.id) && celulaOk(a) && ehCategoria(a.categoria) && dataOk(a.criado_em) && dataOk(a.expira_em))
    .filter((a) => Date.parse(a.expira_em) > agora)
    .map((a) => ({ id: a.id, la: a.la, lo: a.lo, categoria: a.categoria, confirmado: a.confirmado === true, renovado: a.renovado === true, criado_em: a.criado_em, expira_em: a.expira_em }));
  const travadas = (Array.isArray(v?.travadas) ? v.travadas : [])
    .filter((t): t is TravaDeArea => !!t && areaOk(t) && dataOk(t.ate) && Date.parse(t.ate) > agora)
    .map((t) => ({ ala: t.ala, alo: t.alo, ate: t.ate }));
  return { area, avisos, travadas, modera: v?.modera === true };
}

/** A área está travada (na vizinhança lida)? */
export function travada(v: Vizinhanca, a: Area): boolean {
  return v.travadas.some((t) => t.ala === a.ala && t.alo === a.alo);
}

/** Os avisos de uma célula (para o desenho e para o "ainda está lá"). */
export function avisosDaCelula(v: Vizinhanca, c: Celula): AvisoDeLocal[] {
  return v.avisos.filter((a) => a.la === c.la && a.lo === c.lo);
}

/** O pedido de avisar, como sai do aparelho: os dois inteiros da célula e a categoria. Nada mais. */
export function pedidoDeAviso(c: Celula, categoria: Categoria): { p_la: number; p_lo: number; p_categoria: Categoria } {
  if (!celulaOk(c)) throw new Error("celula_invalida");
  if (!ehCategoria(categoria)) throw new Error("categoria_invalida");
  return { p_la: c.la, p_lo: c.lo, p_categoria: categoria };
}

// ───── As áreas seguidas: só no aparelho ─────

/** Até quantas áreas uma pessoa segue. */
export const MAX_SEGUIDAS = 8;
const CHAVE_SEGUIDAS = "alumia:avisos-de-local:areas";

/** Lê as áreas seguidas guardadas neste aparelho (nunca no banco). Sem armazenamento: nenhuma. */
export function lerSeguidas(guarda: Pick<Storage, "getItem"> | null | undefined): Area[] {
  try {
    const bruto = JSON.parse(guarda?.getItem(CHAVE_SEGUIDAS) ?? "[]") as unknown;
    if (!Array.isArray(bruto)) return [];
    const vistas = new Set<string>();
    return bruto.filter((a): a is Area => areaOk(a as Area)).map((a) => ({ ala: a.ala, alo: a.alo })).filter((a) => !vistas.has(chaveDaArea(a)) && !!vistas.add(chaveDaArea(a))).slice(0, MAX_SEGUIDAS);
  } catch {
    return [];
  }
}

/** Guarda as áreas seguidas neste aparelho. Falhou (aba privada, armazenamento cheio): segue sem guardar. */
export function guardarSeguidas(guarda: Pick<Storage, "setItem" | "removeItem"> | null | undefined, areas: Area[]): void {
  try {
    if (!areas.length) guarda?.removeItem(CHAVE_SEGUIDAS);
    else guarda?.setItem(CHAVE_SEGUIDAS, JSON.stringify(areas.slice(0, MAX_SEGUIDAS).map((a) => ({ ala: a.ala, alo: a.alo }))));
  } catch {
    /* sem armazenamento: as áreas valem só nesta aba */
  }
}

/** Liga ou desliga seguir uma área. */
export function alternarSeguida(areas: Area[], a: Area): Area[] {
  const k = chaveDaArea(a);
  return areas.some((x) => chaveDaArea(x) === k) ? areas.filter((x) => chaveDaArea(x) !== k) : [...areas, a].slice(-MAX_SEGUIDAS);
}
