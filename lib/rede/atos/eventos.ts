// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As regras puras da frente 10F (atos e eventos): as datas de uma série (a mesma conta do banco, no horário de Brasília), a
// conferência do formulário de repetir, a limpeza do que vem do servidor (nunca um campo de pessoa, nunca a fila para quem não
// modera) e a conferência do rosto que ficou fora do borrão. Sem React e sem "@/": roda no navegador e no Node dos testes.
import type { Post } from "../tipos";
import {
  FREQUENCIAS_DA_SERIE,
  type AlbumDoAto,
  type DataDaSerie,
  type FotoDoAlbum,
  type MaisDoAto,
  type OrgDoAto,
  type PedidoDeSerie,
  type SerieDoAto,
} from "../tipos-atos";

export const FUSO_DOS_ATOS = "America/Sao_Paulo";
export const MAX_EXCECOES = 24;
const DIA = 86_400_000;

type Fuso = { timeZone?: string };

/** As partes da data-hora no fuso pedido. */
function partes(ms: number, timeZone: string) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  const p: Record<string, number> = {};
  for (const x of f.formatToParts(new Date(ms))) if (x.type !== "literal") p[x.type] = Number(x.value);
  return { y: p.year, m: p.month, d: p.day, h: p.hour % 24, mi: p.minute, s: p.second };
}

/** A data-hora do relógio de parede no fuso pedido, em milissegundos UTC. */
function doRelogio(y: number, m: number, d: number, h: number, mi: number, timeZone: string): number {
  const alvo = Date.UTC(y, m - 1, d, h, mi);
  const desvio = (t: number) => {
    const q = partes(t, timeZone);
    return Date.UTC(q.y, q.m - 1, q.d, q.h, q.mi, q.s) - t;
  };
  const primeiro = alvo - desvio(alvo);
  return alvo - desvio(primeiro);
}

const doisDigitos = (n: number) => String(n).padStart(2, "0");
const diaIso = (y: number, m: number, d: number) => `${y}-${doisDigitos(m)}-${doisDigitos(d)}`;
const ultimoDia = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** O dia (AAAA-MM-DD) de um instante, no fuso dos atos. */
export function diaDoAto(iso: string, o: Fuso = {}): string {
  const q = partes(Date.parse(iso), o.timeZone ?? FUSO_DOS_ATOS);
  return diaIso(q.y, q.m, q.d);
}

/**
 * As datas da série a partir do ato modelo (a primeira é ele mesmo), até `ate` ou até `max` datas. Semanal e quinzenal somam dias;
 * mensal soma meses no mesmo dia (31 vira o último dia do mês, como no banco). A hora fica a do relógio de Brasília.
 */
export function datasDaSerie(inicio: string, pedido: Pick<PedidoDeSerie, "frequencia" | "ate" | "excecoes">, max = 12, o: Fuso = {}): { data: string; inicio: string; pulada: boolean }[] {
  const tz = o.timeZone ?? FUSO_DOS_ATOS;
  const base = partes(Date.parse(inicio), tz);
  if (!Number.isFinite(base.y)) return [];
  const saida: { data: string; inicio: string; pulada: boolean }[] = [];
  for (let n = 0; n < 400 && saida.length < max; n++) {
    let y = base.y;
    let m = base.m;
    let d = base.d;
    if (pedido.frequencia === "mensal") {
      const meses = base.m - 1 + n;
      y = base.y + Math.floor(meses / 12);
      m = (meses % 12) + 1;
      d = Math.min(base.d, ultimoDia(y, m));
    } else {
      const passo = pedido.frequencia === "quinzenal" ? 14 : 7;
      const dt = new Date(Date.UTC(base.y, base.m - 1, base.d) + passo * n * DIA);
      y = dt.getUTCFullYear();
      m = dt.getUTCMonth() + 1;
      d = dt.getUTCDate();
    }
    const data = diaIso(y, m, d);
    if (data > pedido.ate) break;
    saida.push({ data, inicio: new Date(doRelogio(y, m, d, base.h, base.mi, tz)).toISOString(), pulada: pedido.excecoes.includes(data) });
  }
  return saida;
}

/** O formulário de repetir está bom? Mesmas regras do banco: frequência da lista, "até" entre o dia seguinte e um ano, até 24 exceções. */
export function conferirSerie(pedido: { frequencia: string; ate: string; excecoes: string[] }, inicio: string, o: Fuso = {}): { ok: true } | { ok: false; problema: "frequencia" | "ate" | "excecoes" } {
  if (!(FREQUENCIAS_DA_SERIE as readonly string[]).includes(pedido.frequencia)) return { ok: false, problema: "frequencia" };
  const dia = diaDoAto(inicio, o);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(pedido.ate) || pedido.ate <= dia) return { ok: false, problema: "ate" };
  const limite = new Date(Date.parse(`${dia}T12:00:00Z`) + 365 * DIA).toISOString().slice(0, 10);
  if (pedido.ate > limite) return { ok: false, problema: "ate" };
  if (pedido.excecoes.length > MAX_EXCECOES || pedido.excecoes.some((e) => !/^\d{4}-\d{2}-\d{2}$/.test(e))) return { ok: false, problema: "excecoes" };
  return { ok: true };
}

// ───── Limpeza do que vem do servidor ─────

const HANDLE = /^[a-z0-9_]{3,20}$/;
const texto = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const inteiro = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const lista = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

function limparOrg(o: Partial<OrgDoAto> | null | undefined): OrgDoAto | null {
  if (!o || typeof o.handle !== "string" || !HANDLE.test(o.handle)) return null;
  return { handle: o.handle, nome: texto(o.nome, 80) || o.handle, selo: o.selo === true };
}
const orgs = (v: unknown) => lista<Partial<OrgDoAto>>(v).map(limparOrg).filter((x): x is OrgDoAto => x !== null);

const SITUACOES = ["confirmado", "adiado", "cancelado", "pulada", "prevista"] as const;
function limparSerie(s: Partial<SerieDoAto> | null | undefined): SerieDoAto | null {
  if (!s || typeof s.id !== "string" || !FREQUENCIAS_DA_SERIE.includes(s.frequencia as never)) return null;
  return {
    id: s.id,
    frequencia: s.frequencia as SerieDoAto["frequencia"],
    ate: texto(s.ate, 10),
    excecoes: lista<string>(s.excecoes).filter((e) => typeof e === "string").slice(0, MAX_EXCECOES),
    encerrada: s.encerrada === true,
    modelo: s.modelo === true,
    datas: lista<Partial<DataDaSerie>>(s.datas)
      .filter((d) => typeof d.data === "string" && typeof d.inicio === "string")
      .slice(0, 12)
      .map((d) => ({
        data: d.data as string,
        inicio: d.inicio as string,
        id: typeof d.id === "string" ? d.id : null,
        situacao: SITUACOES.includes(d.situacao as never) ? (d.situacao as DataDaSerie["situacao"]) : "prevista",
        atual: d.atual === true,
      })),
  };
}

/** O rede_ato_mais sem nada que não devesse vir: convites só para quem chamou, fila só para quem modera, nunca campo de pessoa. */
export function limparMaisDoAto(m: Partial<MaisDoAto> | null | undefined): MaisDoAto {
  const organiza = m?.organiza === true;
  const chamou = m?.chamou === true;
  const album = (m?.album ?? {}) as Partial<MaisDoAto["album"]>;
  const linha = (m?.linha ?? {}) as Partial<MaisDoAto["linha"]>;
  return {
    organiza,
    chamou,
    coletivos: orgs(m?.coletivos),
    convites: chamou ? orgs(m?.convites) : [],
    meus_convites: orgs(m?.meus_convites),
    minhas_orgs: orgs(m?.minhas_orgs),
    serie: limparSerie(m?.serie),
    pode_repetir: chamou && m?.pode_repetir === true,
    album: { aprovadas: inteiro(album.aprovadas), pendentes: organiza ? inteiro(album.pendentes) : null, pode_enviar: album.pode_enviar === true },
    linha: { aberta: linha.aberta === true, pode_escrever: linha.pode_escrever === true, desde: typeof linha.desde === "string" ? linha.desde : null, ate: typeof linha.ate === "string" ? linha.ate : null },
  };
}

function limparFoto(f: Partial<FotoDoAlbum>): FotoDoAlbum | null {
  if (typeof f.id !== "string") return null;
  const lado = (v: unknown) => (typeof v === "number" && v >= 1 && v <= 8000 ? Math.floor(v) : null);
  return {
    id: f.id,
    largura: lado(f.largura),
    altura: lado(f.altura),
    legenda: texto(f.legenda, 140),
    minha: f.minha === true,
    estado: f.estado === "pendente" ? "pendente" : "aprovada",
    criado_em: typeof f.criado_em === "string" ? f.criado_em : null,
  };
}

/** O álbum: a fila só para quem modera; de foto pendente, só a própria; nunca quem mandou. */
export function limparAlbum(a: Partial<AlbumDoAto> | null | undefined): AlbumDoAto {
  const organiza = a?.organiza === true;
  const fotos = lista<Partial<FotoDoAlbum>>(a?.fotos).map(limparFoto).filter((f): f is FotoDoAlbum => f !== null && (f.estado === "aprovada" || f.minha));
  const pendentes = organiza ? lista<Partial<FotoDoAlbum>>(a?.pendentes).map(limparFoto).filter((f): f is FotoDoAlbum => f !== null) : [];
  return { organiza, pode_enviar: a?.pode_enviar === true, fotos, pendentes: pendentes.map((f) => ({ ...f, estado: "pendente" })) };
}

/** A linha ao vivo sempre em ordem de chegada (o mais antigo primeiro), qualquer que seja a ordem em que veio. */
export function limparLinhaDoAto(l: { itens?: Post[]; proximo?: string | null } | null | undefined): { itens: Post[]; proximo: string | null } {
  const itens = lista<Post>(l?.itens).filter((p) => p && typeof p.id === "string" && typeof p.criado_em === "string");
  itens.sort((a, b) => a.criado_em.localeCompare(b.criado_em) || a.id.localeCompare(b.id));
  return { itens, proximo: typeof l?.proximo === "string" ? l.proximo : null };
}

/** Junta páginas da linha sem repetir post, em ordem de chegada. */
export function juntarLinha(antes: Post[], chegou: Post[]): Post[] {
  const vistos = new Set(antes.map((p) => p.id));
  return limparLinhaDoAto({ itens: [...antes, ...chegou.filter((p) => !vistos.has(p.id))] }).itens;
}

// ───── O rosto que ficou fora do borrão ─────

/** Uma área retangular, em fração da imagem (0 a 1). */
export interface Retangulo {
  x: number;
  y: number;
  w: number;
  h: number;
}

const intersecao = (a: Retangulo, b: Retangulo) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

/**
 * Quantos rostos achados NÃO estão cobertos pelas áreas borradas (coberto = pelo menos 90 % da área do rosto dentro do borrão).
 * Serve para a conferência depois de borrar: o detector do navegador roda de novo e, se achar rosto de fora, a foto não sobe.
 */
export function rostosDeFora(rostos: Retangulo[], areas: Retangulo[]): number {
  return rostos.filter((r) => {
    const total = r.w * r.h;
    if (!(total > 0)) return false;
    const coberto = Math.min(total, areas.reduce((s, a) => s + intersecao(r, a), 0));
    return coberto / total < 0.9;
  }).length;
}
