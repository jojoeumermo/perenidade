// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Item 49 (Prompt 4): seguir #temas do Fediverso, só de servidores aprovados. As regras puras (sem rede): o #tema aceito, o endereço
// da linha pública do #tema num servidor (a API do Mastodon, que a maioria dos servidores fala) e a limpeza do que volta: só texto,
// sem foto, sem avatar, sem nada que faça o aparelho de quem lê falar com o servidor de fora. Os #temas que a pessoa segue ficam
// só neste aparelho. Sem "@/" de propósito (roda nos testes).
import { gravarNoAparelho, lerDoAparelho, type Guarda } from "./aparelho";

/** Uma nota de fora como a Alumia mostra: só texto e o endereço original. */
export interface NotaDeFora {
  url: string;
  conta: string;
  nome: string;
  texto: string;
  aviso: string;
  criado_em: string;
  servidor: string;
}

export const MAXIMO_DE_TEMAS = 10;
export const MAXIMO_DE_SERVIDORES = 5;
export const NOTAS_POR_SERVIDOR = 20;
export const NOTAS_NA_TELA = 40;

/** O #tema aceito (letras e números ASCII e "_", 2 a 40), em minúsculas e sem "#"; torto → nulo. */
export function temaOk(texto: string | null | undefined): string | null {
  const t = (texto ?? "").trim().replace(/^#/, "").toLowerCase();
  return /^[a-z0-9_]{2,40}$/.test(t) && /[a-z_]/.test(t) ? t : null;
}

/** Um domínio aceito (como o banco aceita). */
export function dominioOk(texto: string | null | undefined): string | null {
  const d = (texto ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(d) && d.length <= 253 ? d : null;
}

/** A linha pública do #tema no servidor (API do Mastodon), só https. */
export function enderecoDoTema(dominio: string, tema: string): string {
  return `https://${dominio}/api/v1/timelines/tag/${encodeURIComponent(tema)}?limit=${NOTAS_POR_SERVIDOR}`;
}

/** HTML de fora vira texto puro: quebras viram linha nova, marcas somem, entidades comuns voltam a ser letra. */
export function textoPuro(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Limpa a resposta de um servidor: só as notas públicas e originais (sem impulso), com endereço https; texto puro de até 500
 * letras; sem foto, avatar, cartão nem contagem. O que vier torto é deixado de fora.
 */
export function lerNotasDoTema(json: unknown, dominio: string): NotaDeFora[] {
  if (!Array.isArray(json)) return [];
  const saida: NotaDeFora[] = [];
  for (const x of json.slice(0, NOTAS_POR_SERVIDOR)) {
    if (!x || typeof x !== "object") continue;
    const n = x as Record<string, unknown>;
    if (n.reblog || n.visibility !== "public") continue;
    const url = typeof n.url === "string" ? n.url : typeof n.uri === "string" ? n.uri : "";
    if (!/^https:\/\/[^\s<>"]+$/.test(url) || url.length > 500) continue;
    const criado = typeof n.created_at === "string" && !Number.isNaN(Date.parse(n.created_at)) ? new Date(n.created_at).toISOString() : null;
    if (!criado) continue;
    const conta = (n.account && typeof n.account === "object" ? n.account : {}) as Record<string, unknown>;
    const acct = typeof conta.acct === "string" ? conta.acct.trim() : "";
    if (!/^[A-Za-z0-9_.-]{1,64}(@[a-z0-9.-]{3,253})?$/.test(acct)) continue;
    const texto = textoPuro(typeof n.content === "string" ? n.content : "").slice(0, 500);
    if (!texto) continue;
    saida.push({
      url,
      conta: acct.includes("@") ? acct : `${acct}@${dominio}`,
      nome: textoPuro(typeof conta.display_name === "string" ? conta.display_name : "").slice(0, 60),
      texto,
      aviso: textoPuro(typeof n.spoiler_text === "string" ? n.spoiler_text : "").slice(0, 200),
      criado_em: criado,
      servidor: dominio,
    });
  }
  return saida;
}

/** Junta as notas de vários servidores: sem repetir o mesmo endereço, da mais nova para a mais antiga, até NOTAS_NA_TELA. */
export function juntarNotas(listas: readonly NotaDeFora[][]): NotaDeFora[] {
  const vistas = new Set<string>();
  return listas.flat()
    .sort((a, b) => b.criado_em.localeCompare(a.criado_em))
    .filter((n) => (vistas.has(n.url) ? false : (vistas.add(n.url), true)))
    .slice(0, NOTAS_NA_TELA);
}

/** Os #temas de fora que a pessoa segue (só neste aparelho). */
export function temasSeguidos(g?: Guarda | null): string[] {
  const v = lerDoAparelho<unknown>("fed-temas", g);
  return Array.isArray(v) ? v.map((x) => temaOk(String(x))).filter((x): x is string => !!x).slice(0, MAXIMO_DE_TEMAS) : [];
}
export function seguirTema(tema: string, sim: boolean, g?: Guarda | null): string[] | "invalido" | "muitos" {
  const t = temaOk(tema);
  if (!t) return "invalido";
  const atuais = temasSeguidos(g).filter((x) => x !== t);
  if (sim && atuais.length >= MAXIMO_DE_TEMAS) return "muitos";
  const novos = sim ? [...atuais, t] : atuais;
  gravarNoAparelho("fed-temas", novos.length ? novos : null, g);
  return novos;
}
