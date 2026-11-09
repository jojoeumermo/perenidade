// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O que os stories guardam SÓ no aparelho (nunca vai ao servidor): quais stories eu já vi (para o anel ficar cinza) e de quem eu
// silenciei os stories neste aparelho. É assim que a prancha consegue dizer "Ninguém fica sabendo que você viu": o servidor não
// tem tabela de visualização (PLANO-ALUMIA §5 F5 e §6.4). As chaves começam com "lucia:rede" e o Sair rápido apaga tudo
// (lib/rede/saida.ts). Sem "@/" de propósito (roda no Node nos testes).
import type { GrupoDaFaixa } from "../tipos-stories";

export const CHAVE_VISTOS = "lucia:rede-stories-vistos";
export const CHAVE_SILENCIADOS = "lucia:rede-stories-silenciados";
/** No máximo tantos ids guardados (o resto, o mais velho, sai): um story vive 24 h, então a lista nunca precisa ser grande. */
const MAXIMO_DE_VISTOS = 400;
/** Um "visto" só vale 26 h (24 h de vida + folga): depois disso o story já sumiu e o id não serve para nada. */
const VIDA_DO_VISTO = 26 * 60 * 60 * 1000;

export interface ArmazemSimples {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
}

/** O armazém do navegador, ou nulo (aba anônima com o armazenamento travado, servidor). */
export function armazemDoAparelho(): ArmazemSimples | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function lerJson<T>(a: ArmazemSimples | null, chave: string, padrao: T): T {
  if (!a) return padrao;
  try {
    const v = JSON.parse(a.getItem(chave) ?? "null");
    return v ?? padrao;
  } catch {
    return padrao;
  }
}

function gravar(a: ArmazemSimples | null, chave: string, valor: unknown): void {
  try {
    a?.setItem(chave, JSON.stringify(valor));
  } catch {
    // armazenamento cheio ou travado: o anel só não fica cinza
  }
}

/** Os ids vistos que ainda valem (id → quando vi). */
export function lerVistos(a: ArmazemSimples | null, agora: number): Record<string, number> {
  const bruto = lerJson<Record<string, unknown>>(a, CHAVE_VISTOS, {});
  const vale: Record<string, number> = {};
  if (typeof bruto !== "object" || Array.isArray(bruto)) return vale;
  for (const [id, quando] of Object.entries(bruto)) {
    if (typeof quando === "number" && agora - quando < VIDA_DO_VISTO && /^[\w-]{1,64}$/.test(id)) vale[id] = quando;
  }
  return vale;
}

/** Marca um story como visto NESTE aparelho (e limpa o que já expirou). */
export function marcarVisto(a: ArmazemSimples | null, id: string, agora: number): void {
  const vistos = lerVistos(a, agora);
  vistos[id] = agora;
  const ordem = Object.entries(vistos).sort((x, y) => y[1] - x[1]).slice(0, MAXIMO_DE_VISTOS);
  gravar(a, CHAVE_VISTOS, Object.fromEntries(ordem));
}

/** Todos os stories do grupo já foram vistos? */
export function grupoVisto(grupo: GrupoDaFaixa, vistos: Record<string, number>): boolean {
  return grupo.ids.length > 0 && grupo.ids.every((id) => id in vistos);
}

/** O primeiro story do grupo que eu ainda não vi (para abrir dali); todos vistos = o primeiro. */
export function primeiroNaoVisto(grupo: GrupoDaFaixa, vistos: Record<string, number>): number {
  const i = grupo.ids.findIndex((id) => !(id in vistos));
  return i < 0 ? 0 : i;
}

/** A ordem da faixa: quem tem story que eu não vi vem antes; dentro de cada parte, o mais novo primeiro. Silenciados saem. */
export function ordenarFaixa(grupos: readonly GrupoDaFaixa[], vistos: Record<string, number>, silenciados: readonly string[] = []): GrupoDaFaixa[] {
  return grupos
    .filter((g) => g.ids.length > 0 && !silenciados.includes(g.autora.handle))
    .map((g, i) => ({ g, i, visto: grupoVisto(g, vistos), t: Date.parse(g.ultimo_em) || 0 }))
    .sort((a, b) => Number(a.visto) - Number(b.visto) || b.t - a.t || a.i - b.i)
    .map((x) => x.g);
}

/** De quem eu silenciei os stories neste aparelho (@nomes). */
export function lerSilenciados(a: ArmazemSimples | null): string[] {
  const v = lerJson<unknown>(a, CHAVE_SILENCIADOS, []);
  return Array.isArray(v) ? v.filter((h): h is string => typeof h === "string" && /^[\w.@-]{1,80}$/.test(h)).slice(0, 500) : [];
}

/** Silencia (ou volta a mostrar) os stories de alguém, só neste aparelho. */
export function alternarSilencio(a: ArmazemSimples | null, handle: string, silenciar: boolean): string[] {
  const atual = lerSilenciados(a).filter((h) => h !== handle);
  const novo = silenciar ? [...atual, handle] : atual;
  gravar(a, CHAVE_SILENCIADOS, novo);
  return novo;
}
