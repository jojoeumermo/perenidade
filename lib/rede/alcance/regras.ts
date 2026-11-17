// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As regras puras da frente 13C (sair da Alumia), sem tela e sem banco: o que pode sair, os endereços absolutos, o RSS, o cartão
// para colar em outro site (HTML sem script, com a política de segurança dele) e o arquivo de quem eu sigo (o formato que as
// instâncias do Fediverso importam). O banco decide de verdade o que sai (supabase/migracoes/20261119-alumia-o13-alcance.sql); a
// tela só esconde o botão que não daria em nada. Sem "@/" de propósito (roda nos testes).
import type { Post } from "../tipos";

// ── O que sai ────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Um post como o banco deixa sair (public.rede_alc_rss e public.rede_alc_post). Sem foto, sem lugar de ato, sem número. */
export interface ItemQueSai {
  id: string;
  tipo: string;
  titulo: string | null;
  texto: string;
  longo: boolean;
  aviso: string;
  criado_em: string;
  editado_em: string | null;
  comunidade: { slug: string; nome: string } | null;
  autor: { codinome: string; handle: string | null };
}

/** O canal RSS como o banco devolve. */
export interface CanalQueSai {
  tipo: "perfil" | "comunidade";
  nome: string;
  titulo: string;
  descricao: string;
  itens: ItemQueSai[];
}

/** O post pode ir para fora (cartão e RSS)? Só o de primeiro nível, de público "internet", fora da fila. O banco confere de novo. */
export function postPodeSair(post: Pick<Post, "publico" | "resposta_a" | "retido">): boolean {
  return post.publico === "internet" && post.resposta_a === null && !post.retido;
}

/**
 * A arte em PNG: do post que já é da internet, ou do post da própria pessoa (ela decide levar as próprias palavras). Post de
 * outra pessoa fechado na Alumia não vira imagem para circular fora.
 */
export function postPodeVirarArte(post: Pick<Post, "publico" | "resposta_a" | "retido" | "meu">): boolean {
  return !post.retido && (post.meu || post.publico === "internet");
}

/** O post é um ato (o chamado embutido)? Aí o QR leva à página do ato. */
export function postEhAto(post: Pick<Post, "chamado">): boolean {
  return Boolean(post.chamado?.quando);
}

// ── Endereços ────────────────────────────────────────────────────────────────────────────────────────────────────────────

const IDIOMAS = ["pt", "en", "es", "fr", "ru", "zh"] as const;
export const idiomaOk = (lang: string | null | undefined): string => (IDIOMAS as readonly string[]).includes(lang ?? "") ? (lang as string) : "pt";

const baseOk = (url: string): boolean => /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(url) || /^http:\/\/(?:[a-z0-9.-]*\.)?localhost(:\d+)?$/i.test(url) || /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(url);

/**
 * O endereço absoluto de uma tela da Alumia (caminho relativo a ela: "/p/<id>", "/c/<slug>", "/u/<handle>", "/ato/<id>"). Com o
 * endereço próprio da Alumia, vai para lá (português sem prefixo, como lib/rede/alumia.ts); sem ele, o do site com /[lang]/alumia.
 */
export function enderecoAbsoluto(lang: string, caminho: string, bases: { alumia: string; site: string }): string {
  const l = idiomaOk(lang);
  const resto = caminho.startsWith("/") ? caminho : `/${caminho}`;
  const alumia = bases.alumia.trim().replace(/\/+$/, "");
  if (baseOk(alumia)) return l === "pt" ? `${alumia}${resto}` : `${alumia}/${l}${resto}`;
  const site = bases.site.trim().replace(/\/+$/, "");
  return `${site}/${l}/alumia${resto}`;
}

/** Os endereços desta frente no servidor do site (sempre no site: as rotas /api não moram no endereço da Alumia). */
export const rotasDoAlcance = {
  rss: (site: string, tipo: "perfil" | "comunidade", nome: string, lang = "pt") =>
    `${site.replace(/\/+$/, "")}/api/rede/rss/${tipo === "perfil" ? "u" : "c"}/${encodeURIComponent(nome)}${idiomaOk(lang) === "pt" ? "" : `?lang=${idiomaOk(lang)}`}`,
  cartao: (site: string, id: string, lang = "pt") => `${site.replace(/\/+$/, "")}/api/rede/embed/${id}${idiomaOk(lang) === "pt" ? "" : `?lang=${idiomaOk(lang)}`}`,
} as const;

export const ID_OK = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const HANDLE_OK = /^[a-z0-9_]{3,20}$/;
export const SLUG_OK = /^[a-z0-9-]{2,60}$/;

// ── Escapar ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Tira o que não é caractere válido em XML 1.0 (controle, meio de par substituto) e os de direção (que viram o texto ao avesso). */
export function semControle(texto: string): string {
  return String(texto ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F￾￿]/g, "")
    .replace(/[‪-‮⁦-⁩]/g, "")
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "");
}

/** Escapa para dentro de XML e de HTML (texto e atributo entre aspas duplas). */
export function escapar(texto: string): string {
  return semControle(texto).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// ── RSS ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface TextosDoRss {
  /** "Posts públicos de {nome} na Alumia" */
  descricaoPerfil: string;
  /** "Posts públicos da comunidade {nome} na Alumia" */
  descricaoComunidade: string;
  /** "Aviso de conteúdo: {aviso}" */
  aviso: string;
  /** "Continua na Alumia" */
  continua: string;
  /** "Post de {codinome}" (quando o post não tem título) */
  semTitulo: string;
}

const preencher = (modelo: string, campos: Record<string, string>) => modelo.replace(/\{(\w+)\}/g, (m, k: string) => (k in campos ? campos[k] : m));
const dataRfc = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? new Date(0).toUTCString() : d.toUTCString();
};
const resumo = (texto: string, max: number) => {
  const t = semControle(texto).replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
};

/** O título de um item: o do post, ou as primeiras palavras do texto, ou "Post de …". */
export function tituloDoItem(item: ItemQueSai, textos: Pick<TextosDoRss, "semTitulo">): string {
  if (item.titulo && item.titulo.trim()) return resumo(item.titulo, 140);
  if (!item.aviso && item.texto.trim()) return resumo(item.texto, 80);
  return preencher(textos.semTitulo, { codinome: item.autor.codinome });
}

/**
 * O RSS 2.0 de um canal. Texto puro dentro de <description> (escapado, sem HTML de quem escreveu); o post com aviso de conteúdo
 * leva o aviso na frente, e o título não adianta o texto. Nada de foto, número ou e-mail.
 */
export function montarRss(canal: CanalQueSai, opcoes: { lang: string; bases: { alumia: string; site: string }; textos: TextosDoRss; proprio: string }): string {
  const { lang, bases, textos } = opcoes;
  const pagina = enderecoAbsoluto(lang, canal.tipo === "perfil" ? `/u/${canal.nome}` : `/c/${canal.nome}`, bases);
  const descricao = canal.descricao?.trim()
    ? resumo(canal.descricao, 500)
    : preencher(canal.tipo === "perfil" ? textos.descricaoPerfil : textos.descricaoComunidade, { nome: canal.titulo });
  const itens = canal.itens.map((item) => {
    const link = enderecoAbsoluto(lang, `/p/${item.id}`, bases);
    const partes = [
      item.aviso ? preencher(textos.aviso, { aviso: resumo(item.aviso, 200) }) : "",
      semControle(item.texto).trim(),
      item.longo ? `${textos.continua}: ${link}` : "",
    ].filter(Boolean);
    const autor = item.autor.handle ? `${item.autor.codinome} (@${item.autor.handle})` : item.autor.codinome;
    return [
      "    <item>",
      `      <title>${escapar(item.aviso ? preencher(textos.aviso, { aviso: resumo(item.aviso, 120) }) : tituloDoItem(item, textos))}</title>`,
      `      <link>${escapar(link)}</link>`,
      `      <guid isPermaLink="true">${escapar(link)}</guid>`,
      `      <pubDate>${dataRfc(item.criado_em)}</pubDate>`,
      `      <dc:creator>${escapar(autor)}</dc:creator>`,
      item.comunidade ? `      <category>${escapar(item.comunidade.nome)}</category>` : "",
      `      <description>${escapar(partes.join("\n\n"))}</description>`,
      "    </item>",
    ].filter(Boolean).join("\n");
  });
  const ultimo = canal.itens.reduce<string | null>((m, i) => (!m || i.criado_em > m ? i.criado_em : m), null);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">',
    "  <channel>",
    `    <title>${escapar(`${canal.titulo} · Alumia`)}</title>`,
    `    <link>${escapar(pagina)}</link>`,
    `    <description>${escapar(descricao)}</description>`,
    `    <language>${lang === "zh" ? "zh-CN" : lang === "pt" ? "pt-BR" : lang}</language>`,
    `    <atom:link href="${escapar(opcoes.proprio)}" rel="self" type="application/rss+xml"/>`,
    ultimo ? `    <lastBuildDate>${dataRfc(ultimo)}</lastBuildDate>` : "",
    "    <ttl>30</ttl>",
    ...itens,
    "  </channel>",
    "</rss>",
    "",
  ].filter((l) => l !== "").join("\n");
}

// ── O cartão para colar em outro site ────────────────────────────────────────────────────────────────────────────────────

export interface TextosDoCartao {
  /** "Aviso de conteúdo: {aviso}" */
  aviso: string;
  /** "Mostrar" (o texto atrás do aviso) */
  mostrar: string;
  /** "Ler na Alumia" */
  abrir: string;
  /** "Publicado na Alumia, a rede social do Instituto Lúcia" */
  rodape: string;
}

/**
 * O estilo do cartão, fixo (o hash dele vai na política de segurança: nenhum outro estilo roda). As cores são os tokens da
 * Alumia (styles/alumia-tokens.css) declarados aqui, porque o cartão vive fora da casca: noite por padrão, creme quando o site que
 * embute está no claro. Sem fonte de fora: a Archivo do aparelho, se houver, ou a condensada do sistema.
 */
export const ESTILO_DO_CARTAO = [
  ":root{--al-fundo:#0f0e0d;--al-superficie:#1b1917;--al-linha:#2a2622;--al-texto:#f3efe6;--al-texto-2:#d9d3c9;--al-texto-3:#a9a29a;--al-vermelho:#e8321f;--al-vermelho-texto:#d42a18;--al-dourado:#ffc21a;--al-foco:#ffc21a;--al-sobre-vermelho:#ffffff;--al-faixa:linear-gradient(to right,#c21f16 0 16.667%,#f0b323 16.667% 23.333%,#23408e 23.333% 33.333%,#f3efe6 33.333% 36.667%,#2e6b4f 36.667% 50%,#e4577f 50% 56.667%,#ea7a24 56.667% 66.667%,#0f0e0d 66.667% 70%,#1f8a85 70% 80%,#f0b323 80% 86.667%,#c21f16 86.667% 100%);color-scheme:dark}",
  "@media (prefers-color-scheme:light){:root{--al-fundo:#f3efe6;--al-superficie:#fbf8f2;--al-linha:#d5cdbf;--al-texto:#0f0e0d;--al-texto-2:#2f2a25;--al-texto-3:#5c554d;--al-vermelho:#bc2217;--al-vermelho-texto:#bc2217;--al-dourado:#7a5800;--al-foco:#0f0e0d;color-scheme:light}}",
  "*{box-sizing:border-box}",
  "html,body{margin:0;background:var(--al-fundo);color:var(--al-texto);font:16px/1.5 Archivo,'Archivo Narrow','Roboto Condensed','Arial Narrow',system-ui,sans-serif}",
  "a{color:inherit}",
  "a:focus-visible,summary:focus-visible{outline:2px solid var(--al-foco);outline-offset:2px}",
  ".c{display:flex;flex-direction:column;min-height:100vh;max-width:640px;margin:0 auto;background:var(--al-superficie);border:1px solid var(--al-linha)}",
  ".f{height:6px;background:var(--al-faixa)}",
  ".m{flex:1;padding:16px 18px 12px}",
  ".q{display:flex;align-items:center;gap:10px;margin:0 0 10px}",
  ".l{display:grid;grid-template-columns:repeat(2,9px);gap:2px;flex:none}.l i{width:9px;height:9px;border-radius:2px;background:var(--al-texto)}.l i:nth-child(2){background:var(--al-vermelho)}.l i:nth-child(3){background:var(--al-dourado)}",
  ".a{min-width:0;line-height:1.2}.a b{display:block;font-weight:800}.a small{color:var(--al-texto-3);font-size:13px}",
  ".p{display:inline-block;margin:0 0 8px;padding:2px 9px;border:1.5px solid currentColor;border-radius:999px;color:var(--al-texto-2);font-size:12px;font-weight:700;text-decoration:none}",
  "h1{margin:0 0 6px;font-size:26px;line-height:.95;font-weight:900;font-stretch:62%;font-variation-settings:'wdth' 62;text-transform:uppercase;letter-spacing:-.01em}",
  ".t{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:8;overflow:hidden;color:var(--al-texto-2)}",
  "details{margin:0 0 6px;border-left:4px solid var(--al-dourado);padding:6px 10px;border-radius:4px;background:var(--al-fundo)}summary{cursor:pointer;font-weight:700}",
  ".r{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;padding:10px 18px 14px;border-top:1px solid var(--al-linha);font-size:13px;color:var(--al-texto-3)}",
  ".b{display:inline-flex;align-items:center;min-height:40px;padding:6px 14px;border-radius:10px;background:var(--al-vermelho-texto);color:var(--al-sobre-vermelho);font-weight:800;text-decoration:none;text-transform:uppercase;letter-spacing:.02em;font-stretch:75%}",
].join("");

/** A política de segurança do cartão: nada roda, nada carrega, ninguém envia formulário; qualquer site pode embutir. */
export function politicaDoCartao(hashDoEstilo: string): string {
  return [
    "default-src 'none'",
    `style-src '${hashDoEstilo}'`,
    "img-src 'none'",
    "font-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors *",
    "sandbox allow-popups allow-popups-to-escape-sandbox",
  ].join("; ");
}

const dataCurta = (iso: string, lang: string): string => {
  try {
    return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : lang === "pt" ? "pt-BR" : lang, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
};

/** O HTML do cartão (sem script). Os links abrem em outra aba, sem levar de onde veio. */
export function montarCartao(item: ItemQueSai, opcoes: { lang: string; bases: { alumia: string; site: string }; textos: TextosDoCartao }): string {
  const { lang, bases, textos } = opcoes;
  const link = enderecoAbsoluto(lang, `/p/${item.id}`, bases);
  const perfil = item.autor.handle ? enderecoAbsoluto(lang, `/u/${item.autor.handle}`, bases) : null;
  const comunidade = item.comunidade ? enderecoAbsoluto(lang, `/c/${item.comunidade.slug}`, bases) : null;
  const fora = 'target="_blank" rel="noopener noreferrer"';
  const corpo = `${item.titulo?.trim() ? `<h1>${escapar(resumo(item.titulo, 140))}</h1>` : ""}<p class="t">${escapar(semControle(item.texto).trim())}</p>`;
  const titulo = item.titulo?.trim() ? resumo(item.titulo, 80) : `${item.autor.codinome} · Alumia`;
  return [
    "<!doctype html>",
    `<html lang="${lang === "pt" ? "pt-BR" : escapar(lang)}">`,
    '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">',
    '<meta name="referrer" content="no-referrer">',
    `<title>${escapar(titulo)}</title><style>${ESTILO_DO_CARTAO}</style></head>`,
    '<body><article class="c"><div class="f" aria-hidden="true"></div><div class="m">',
    '<div class="q"><span class="l" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="a">',
    perfil
      ? `<b><a href="${escapar(perfil)}" ${fora}>${escapar(item.autor.codinome)}</a></b><small>@${escapar(item.autor.handle ?? "")}</small>`
      : `<b>${escapar(item.autor.codinome)}</b>`,
    "</span></div>",
    comunidade && item.comunidade ? `<a class="p" href="${escapar(comunidade)}" ${fora}>${escapar(item.comunidade.nome)}</a>` : "",
    item.aviso
      ? `<details><summary>${escapar(textos.aviso.replace("{aviso}", resumo(item.aviso, 200)))} · ${escapar(textos.mostrar)}</summary>${corpo}</details>`
      : corpo,
    "</div>",
    `<footer class="r"><span><time datetime="${escapar(item.criado_em)}">${escapar(dataCurta(item.criado_em, lang))}</time> · ${escapar(textos.rodape)}</span>`,
    `<a class="b" href="${escapar(link)}" ${fora}>${escapar(textos.abrir)}</a></footer>`,
    "</article></body></html>",
  ].join("");
}

/** O código para colar em outro site: só um quadro com sandbox (nenhum script nosso nem de ninguém roda na página de lá). */
export function codigoParaColar(endereco: string, titulo: string): string {
  return `<iframe src="${escapar(endereco)}" title="${escapar(titulo)}" width="100%" height="380" style="max-width:640px;border:0;border-radius:14px" sandbox="allow-popups allow-popups-to-escape-sandbox" referrerpolicy="no-referrer" loading="lazy"></iframe>`;
}

// ── Quem eu sigo: o arquivo ──────────────────────────────────────────────────────────────────────────────────────────────

/** O cabeçalho que as instâncias do Fediverso (Mastodon e as que copiam o formato) leem e escrevem. */
export const CABECALHO_DA_LISTA = "Account address,Show boosts,Notify on new posts,Languages";
/** No máximo tantos endereços por vez (o banco segura 200 seguidas por dia: rede_perfil_seguir). */
export const MAXIMO_POR_VEZ = 200;

const CONTA = /^@?([a-z0-9_.-]{1,64})@([a-z0-9.-]{3,253}(?::\d{1,5})?)$/i;

/** Um endereço "nome@servidor" limpo (minúsculo, sem @ na frente), ou nulo. */
export function contaLimpa(texto: string): string | null {
  const m = CONTA.exec(texto.trim().replace(/^acct:/i, ""));
  if (!m) return null;
  const dominio = m[2].toLowerCase();
  if (!dominio.includes(".") && !/^localhost(:\d+)?$/.test(dominio)) return null;
  return `${m[1].toLowerCase()}@${dominio}`;
}

/** O arquivo da lista (CSV no formato do Fediverso): os @ daqui com o domínio da Alumia, os de fora como vieram. */
export function arquivoDaLista(lista: { locais: string[]; fora: string[] }, dominio: string): string {
  const vistos = new Set<string>();
  const linhas: string[] = [CABECALHO_DA_LISTA];
  const dom = dominio.trim().toLowerCase();
  for (const h of lista.locais) {
    const conta = HANDLE_OK.test(h) && dom ? `${h}@${dom}` : null;
    if (conta && !vistos.has(conta)) {
      vistos.add(conta);
      linhas.push(`${conta},true,false,`);
    }
  }
  for (const f of lista.fora) {
    const conta = contaLimpa(f);
    if (conta && !vistos.has(conta)) {
      vistos.add(conta);
      linhas.push(`${conta},true,false,`);
    }
  }
  return `${linhas.join("\n")}\n`;
}

/**
 * Lê uma lista colada ou um arquivo: CSV do Fediverso (primeira coluna), uma conta por linha, ou separadas por vírgula ou espaço.
 * Devolve as contas válidas sem repetir (na ordem em que vieram) e quantas linhas não deram para ler.
 */
export function lerLista(texto: string): { contas: string[]; ignoradas: number } {
  const contas: string[] = [];
  const vistos = new Set<string>();
  let ignoradas = 0;
  for (const linha of String(texto ?? "").replace(/^﻿/, "").split(/\r?\n/)) {
    const limpa = linha.trim();
    if (!limpa || /^account address\b/i.test(limpa) || limpa.startsWith("#")) continue;
    // CSV do Fediverso: só a primeira coluna é a conta. Sem vírgula, a linha pode ter várias contas separadas por espaço.
    const pedacos = limpa.includes(",") && /,(true|false)/i.test(limpa) ? [limpa.split(",")[0]] : limpa.split(/[\s,;]+/);
    for (const p of pedacos) {
      if (!p) continue;
      const conta = contaLimpa(p.replace(/^"|"$/g, ""));
      if (!conta) {
        ignoradas++;
        continue;
      }
      if (!vistos.has(conta)) {
        vistos.add(conta);
        contas.push(conta);
      }
    }
  }
  return { contas, ignoradas };
}

/** A conta é daqui (um dos domínios da Alumia)? Devolve o @ local; senão nulo (é de outra instância). */
export function handleDaqui(conta: string, dominios: readonly string[]): string | null {
  const [nome, dominio] = conta.split("@");
  if (!nome || !dominio) return null;
  return dominios.map((d) => d.toLowerCase()).filter(Boolean).includes(dominio.toLowerCase()) && HANDLE_OK.test(nome) ? nome : null;
}
