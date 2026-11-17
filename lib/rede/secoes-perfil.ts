// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Onda 12, frente 12D (perfil): as regras PURAS das seções do perfil, dos links organizados e conferidos, do status com a lista
// fechada nova, do histórico de voluntariado e dos pacotes iniciais. Tudo aqui é escolha entre valores conhecidos ou valor
// conferido por expressão regular; o banco confere tudo de novo (supabase/migracoes/20261118-alumia-o12-perfil.sql) e o teste
// (scripts/testar-alumia-o12-perfil.mjs) prova que as listas e os limites daqui são os do banco.
// Sem DOM e sem "@/" de propósito (roda no Node nos testes).
import { linkLimpo } from "./aparencia";
import { STATUS_DO_PERFIL } from "./tipos-org";

// ───────────────────────────── Seções ─────────────────────────────

/**
 * As seções que a pessoa pode pôr no perfil, na ordem que ela escolher. Nenhuma aparece sem escolha: a lista guardada começa
 * vazia. "destaques", "colecoes" e "conquistas" são as peças que outras frentes penduram no perfil (encaixe abasDoPerfil): com
 * as seções escolhidas, elas seguem a ordem e a escolha da pessoa.
 */
export const SECOES_DO_PERFIL = ["sobre", "links", "trilhas", "comunidades", "voluntariado", "destaques", "colecoes", "conquistas"] as const;
export type SecaoDoPerfil = (typeof SECOES_DO_PERFIL)[number];

/** As seções que são peças encaixadas por outras frentes (a chave é a mesma do encaixe). */
export const SECOES_ENCAIXADAS: readonly SecaoDoPerfil[] = ["destaques", "colecoes", "conquistas"];
/** As seções desenhadas por esta frente. */
export const SECOES_PROPRIAS: readonly SecaoDoPerfil[] = ["sobre", "links", "trilhas", "comunidades", "voluntariado"];

export const LIMITES_DO_PERFIL = {
  secoes: SECOES_DO_PERFIL.length,
  sobre: 1000,
  comunidades: 6,
  links: 8,
  tituloDoLink: 40,
  url: 200,
  voluntariado: 10,
  anoMinimo: 2015,
} as const;

/** Só seções conhecidas, sem repetir, na ordem que vieram. */
export function arrumarSecoes(bruto: unknown): SecaoDoPerfil[] {
  const vistas: SecaoDoPerfil[] = [];
  if (Array.isArray(bruto)) for (const s of bruto) if ((SECOES_DO_PERFIL as readonly unknown[]).includes(s) && !vistas.includes(s as SecaoDoPerfil)) vistas.push(s as SecaoDoPerfil);
  return vistas.slice(0, LIMITES_DO_PERFIL.secoes);
}

/** Ligar (no fim) ou desligar uma seção. */
export function alternarSecao(secoes: readonly SecaoDoPerfil[], secao: SecaoDoPerfil, ligar: boolean): SecaoDoPerfil[] {
  const sem = secoes.filter((s) => s !== secao);
  return ligar ? [...sem, secao] : sem;
}

/** Sobe (-1) ou desce (+1) uma seção uma casa. */
export function moverSecao(secoes: readonly SecaoDoPerfil[], secao: SecaoDoPerfil, passo: -1 | 1): SecaoDoPerfil[] {
  const i = secoes.indexOf(secao);
  const j = i + passo;
  if (i < 0 || j < 0 || j >= secoes.length) return [...secoes];
  const nova = [...secoes];
  [nova[i], nova[j]] = [nova[j], nova[i]];
  return nova;
}

/** Um item da fileira do perfil: uma seção desta frente ou uma peça encaixada por outra. */
export type ItemDaFileira = { tipo: "secao"; chave: SecaoDoPerfil } | { tipo: "encaixe"; chave: string };

/**
 * A ordem do que aparece acima das abas do perfil. Sem escolha guardada (`secoes` nulo: a pessoa nunca abriu as seções), fica
 * como sempre foi: as peças encaixadas na ordem do encaixe, e nenhuma seção desta frente. Com escolha, as seções e as peças
 * encaixadas que são seções seguem a ordem da pessoa, e só as escolhidas aparecem; as peças que não são seção (os espaços da
 * organização, por exemplo) vêm depois, como antes.
 */
export function ordemDaFileira(secoes: readonly SecaoDoPerfil[] | null, encaixes: readonly string[]): ItemDaFileira[] {
  if (secoes === null) return encaixes.map((chave) => ({ tipo: "encaixe" as const, chave }));
  const saida: ItemDaFileira[] = [];
  for (const s of secoes) {
    if (SECOES_ENCAIXADAS.includes(s)) {
      if (encaixes.includes(s)) saida.push({ tipo: "encaixe", chave: s });
    } else saida.push({ tipo: "secao", chave: s });
  }
  for (const chave of encaixes) if (!(SECOES_ENCAIXADAS as readonly string[]).includes(chave)) saida.push({ tipo: "encaixe", chave });
  return saida;
}

/** O "Sobre": texto puro, sem caracteres de controle nem de direção, quebras de linha no máximo duplas. */
export function arrumarSobre(texto: string): string {
  return texto
    .replace(/\r/g, "")
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f​-‏‪-‮⁦-⁩]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, LIMITES_DO_PERFIL.sobre);
}

// ───────────────────────────── Links organizados e conferidos ─────────────────────────────

/** Um link do perfil, como a pessoa organiza: título curto e endereço https limpo. */
export interface LinkDoPerfil {
  id?: string;
  titulo: string;
  url: string;
}

/** Como um link foi conferido: rel="me" (o site da pessoa aponta de volta) ou pela mediação (Instagram). */
export type ConferidoComo = "rel_me" | "mediacao";

/** Os sites em que não dá para pôr rel="me": a mediação confere à mão, pelo código que a pessoa põe na bio de lá. */
export const SITES_DA_MEDIACAO = ["instagram.com"] as const;

/** O domínio do link pede a mediação (e não o rel="me")? */
export function linkPedeMediacao(url: string): boolean {
  const l = linkLimpo(url);
  if (!l) return false;
  return (SITES_DA_MEDIACAO as readonly string[]).includes(l.dominio);
}

/** Título de 1 a 40 letras, sem controle; nulo se não servir. */
export function tituloDoLinkOk(titulo: string): string | null {
  const t = titulo.replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, " ").replace(/\s+/g, " ").trim();
  return t.length >= 1 && t.length <= LIMITES_DO_PERFIL.tituloDoLink && !/(https?:\/\/|www\.)/i.test(t) ? t : null;
}

/** Os links que vão ao banco: só os que passam (título e endereço limpo), sem repetir o endereço, até 8. */
export function arrumarLinks(links: readonly LinkDoPerfil[]): LinkDoPerfil[] {
  const saida: LinkDoPerfil[] = [];
  for (const l of links) {
    const titulo = tituloDoLinkOk(l.titulo);
    const limpo = linkLimpo(l.url);
    if (!titulo || !limpo || limpo.href.length > LIMITES_DO_PERFIL.url) continue;
    if (saida.some((x) => x.url === limpo.href)) continue;
    saida.push({ titulo, url: limpo.href });
    if (saida.length >= LIMITES_DO_PERFIL.links) break;
  }
  return saida;
}

const IDIOMAS = "(pt|en|es|fr|ru|zh)";

/**
 * O endereço `href` é o perfil desta pessoa na Alumia? Vale o perfil em qualquer das bases (o endereço próprio da Alumia e o do
 * site), com ou sem idioma, com ou sem "/alumia", e o @ do Fediverso na base da Alumia. Sem consulta, sem fragmento.
 */
export function apontaParaOPerfil(href: string, handle: string, bases: readonly string[]): boolean {
  if (!/^[a-z0-9_]{3,20}$/.test(handle)) return false;
  let u: URL;
  try {
    u = new URL(href.trim());
  } catch {
    return false;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  if (u.search || u.username || u.password) return false;
  const origem = `${u.protocol}//${u.host}`.toLowerCase();
  const caminho = u.pathname.replace(/\/+$/, "");
  const perfil = new RegExp(`^(/${IDIOMAS})?(/alumia)?/u/${handle}$`);
  const arroba = new RegExp(`^/@${handle}$`);
  return bases.some((b) => {
    const base = b.trim().replace(/\/+$/, "").toLowerCase();
    if (!/^https?:\/\/[a-z0-9.:-]+$/.test(base)) return false;
    // O site em https vale também quando o link de lá diz http (a pessoa copiou sem o "s"); o contrário, não.
    const mesma = origem === base || (base.startsWith("https://") && origem === `http://${base.slice(8)}`);
    return mesma && (perfil.test(caminho) || arroba.test(caminho));
  });
}

/** Os atributos de uma etiqueta HTML (`<a ...>` ou `<link ...>`), em minúsculas nos nomes. */
function atributos(etiqueta: string): Record<string, string> {
  const saida: Record<string, string> = {};
  for (const m of etiqueta.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g)) {
    const nome = m[1].toLowerCase();
    if (!(nome in saida)) saida[nome] = (m[3] ?? m[4] ?? m[5] ?? "").replace(/&amp;/g, "&").replace(/&#x2f;|&#47;/gi, "/");
  }
  return saida;
}

/**
 * A página de fora tem um link rel="me" que aponta para o perfil desta pessoa? Lê só as etiquetas `<a>` e `<link>` (nada de
 * script roda: é texto). O rel pode ter mais de uma palavra ("me noopener"); o href pode ser relativo à página.
 */
export function paginaApontaDeVolta(html: string, paginaUrl: string, handle: string, bases: readonly string[]): boolean {
  const semComentarios = html.replace(/<!--[\s\S]*?-->/g, "");
  for (const m of semComentarios.matchAll(/<(a|link)\b([^>]*)>/gi)) {
    const a = atributos(m[2]);
    const rel = (a.rel ?? "").toLowerCase().split(/\s+/);
    if (!rel.includes("me") || !a.href) continue;
    let alvo: string;
    try {
      alvo = new URL(a.href, paginaUrl).href;
    } catch {
      continue;
    }
    if (apontaParaOPerfil(alvo, handle, bases)) return true;
  }
  return false;
}

// ───────────────────────────── Status: a lista fechada ─────────────────────────────

/**
 * A lista fechada do status (L2-61): as cinco de antes e as duas pedidas, "na luta" (para quem não quer dizer greve nem ato) e
 * "ausente" (volta no prazo). Sempre escolhido à mão, com prazo, sem lugar e sem "visto por último".
 */
export const STATUS_NOVOS = ["na_luta", "ausente"] as const;
export const STATUS_TODOS = [...STATUS_DO_PERFIL, ...STATUS_NOVOS] as const;
export type StatusDaLista = (typeof STATUS_TODOS)[number];
export const statusDaLista = (s: unknown): s is StatusDaLista => (STATUS_TODOS as readonly unknown[]).includes(s);

/** Quem vê o status: todo mundo que vê o perfil, ou só a roda de confiança da pessoa. */
export const PUBLICOS_DO_STATUS = ["todos", "roda"] as const;
export type PublicoDoStatus = (typeof PUBLICOS_DO_STATUS)[number];

// ───────────────────────────── Histórico de voluntariado ─────────────────────────────

/**
 * As frentes de trabalho do Instituto que entram no histórico. Lista fechada e sem frente política (filiação e opinião política
 * são dado sensível, LGPD art. 11): quem atua numa frente política simplesmente não a declara aqui.
 */
export const FRENTES_DE_VOLUNTARIADO = [
  "educacao", "curadoria", "mediacao", "revisao", "traducao", "jornalismo", "comunicacao", "mentoria", "design", "desenvolvimento",
  "saude", "parcerias", "eventos",
] as const;
export type FrenteDeVoluntariado = (typeof FRENTES_DE_VOLUNTARIADO)[number];

/** Uma linha do histórico: a frente e o período em anos (nunca dia nem mês). */
export interface Voluntariado {
  id?: string;
  frente: FrenteDeVoluntariado;
  de: number;
  /** Nulo = até hoje. */
  ate: number | null;
  situacao?: "esperando" | "confirmado" | "recusado";
}

/** O período vale? De 2015 até o ano que vem, "até" nunca antes de "de". */
export function periodoOk(de: number, ate: number | null, agora: Date = new Date()): boolean {
  const teto = agora.getUTCFullYear() + 1;
  if (!Number.isInteger(de) || de < LIMITES_DO_PERFIL.anoMinimo || de > teto) return false;
  if (ate === null) return true;
  return Number.isInteger(ate) && ate >= de && ate <= teto;
}

/** "2024 – 2026", "2025" ou "2023 – hoje" (com a palavra do idioma). */
export function periodoEmTexto(de: number, ate: number | null, hoje: string): string {
  if (ate === null) return `${de} – ${hoje}`;
  return ate === de ? String(de) : `${de} – ${ate}`;
}

// ───────────────────────────── Pacotes iniciais ─────────────────────────────

export const slugDoPacoteOk = (s: string): boolean => /^[a-z0-9-]{2,60}$/.test(s);

/** O endereço do pacote (relativo ao idioma): é o que o link e o QR levam. */
export const enderecoDoPacote = (lang: string, slug: string): string => `/${lang}/alumia/pacote/${slug}`;

/** O número de pessoas que a tela mostra: só a partir de 3 (abaixo disso, nada). */
export const numeroQueAparece = (n: number | null | undefined): number | null => (typeof n === "number" && n >= 3 ? n : null);
