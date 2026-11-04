// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Metadata } from "next";
import { defaultLocale, htmlLang, type Locale, locales } from "@/i18n/config";
import { site } from "@/lib/site";

/** Páginas que não entram nos buscadores: só fazem sentido para quem está usando o site naquele momento. */
// O Mural de Saúde mostra nome, registro e contato de pessoas: fica fora dos buscadores (e do sitemap) até a
// revisão jurídica decidir o contrário. O texto público do termo (/saude/termo) não tem dado pessoal e continua indexado.
const PRIVADAS = new Set(["/busca", "/denunciar", "/reforco", "/meus-dados", "/certificado", "/entrar", "/painel", "/fora-do-ar", "/apoie/anterior", "/saude", "/vale-o-escrito/enviar", "/vale-o-escrito/correcao"]);

/**
 * O endereço canônico da página no idioma dela e as versões nos outros idiomas (hreflang), com x-default em português.
 * Com "idiomas" (os idiomas em que o TEXTO existe de verdade), uma página que só repete o original em português não é
 * anunciada como tradução: ela aponta o canônico para a versão em português e fica fora do hreflang.
 */
export function alternatesDe(lang: Locale, path: string, idiomas: readonly Locale[] = locales): NonNullable<Metadata["alternates"]> {
  const existentes = locales.filter((code) => idiomas.includes(code));
  const languages = Object.fromEntries(existentes.map((code) => [htmlLang[code], `${site.url}/${code}${path}`]));
  const canonico = existentes.includes(lang) ? lang : defaultLocale;
  return { canonical: `${site.url}/${canonico}${path}`, languages: { ...languages, "x-default": `${site.url}/${defaultLocale}${path}` } };
}

/** Os tamanhos máximos dos campos do cartão (título, subtítulo e rótulo), os mesmos na página e em app/api/og. */
export const OG_LIMITES = { t: 120, s: 160, k: 60 } as const;
/** Corta por caractere (e não por metade de um, como o slice faria num emoji ou num ideograma raro): assim a assinatura confere. */
export const cortarOg = (texto: string, n: number) => Array.from(texto).slice(0, n).join("");
/** Quantos caracteres o texto tem, contados do mesmo jeito que cortarOg. */
export const tamanhoOg = (texto: string) => Array.from(texto).length;

/**
 * A assinatura do cartão: com o segredo OG_SEGREDO (o mesmo no build e no servidor), só os cartões que o próprio site
 * monta são desenhados. Sem ela, qualquer robô que variasse o título gerava uma imagem nova (processamento, chamadas ao
 * Google Fonts e uma entrada de cache a mais). Assina os campos, não o endereço, para que a ordem ou a codificação da
 * query não importem. Sem o segredo configurado, devolve vazio e nada é exigido.
 */
export function assinaturaOg(campos: { l: string; t: string; s: string; k: string }): string {
  const segredo = process.env.OG_SEGREDO ?? "";
  if (!segredo) return "";
  return createHmac("sha256", segredo).update([campos.l, campos.t, campos.s, campos.k].join("\n")).digest("base64url").slice(0, 22);
}

/** Confere a assinatura em tempo constante. Sem o segredo configurado, aceita tudo (o comportamento de antes). */
export function assinaturaOgConfere(campos: { l: string; t: string; s: string; k: string }, h: string): boolean {
  const esperada = assinaturaOg(campos);
  if (!esperada) return true;
  const a = Buffer.from(esperada);
  const b = Buffer.from(h);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** A imagem de compartilhamento gerada para esta página (app/api/og), com a identidade do instituto. */
export function ogDe(lang: Locale, titulo: string, subtitulo = "", kicker = "") {
  const campos = { l: lang, t: cortarOg(titulo, OG_LIMITES.t), s: cortarOg(subtitulo, OG_LIMITES.s), k: cortarOg(kicker, OG_LIMITES.k) };
  const q = new URLSearchParams(campos);
  const h = assinaturaOg(campos);
  if (h) q.set("h", h);
  return [{ url: `/api/og?${q.toString()}`, width: 1200, height: 630, alt: titulo }];
}

/**
 * Os metadados de uma página pública: título, descrição, canônico, hreflang e o cartão de compartilhamento.
 * As páginas privadas (busca, denúncia, reforço, meus dados…) saem com noindex.
 */
export function paginaMeta(
  lang: Locale,
  path: string,
  title: string,
  description?: string,
  og: { titulo?: string; subtitulo?: string; kicker?: string } = {},
  { idiomas }: { idiomas?: readonly Locale[] } = {},
): Metadata {
  const images = ogDe(lang, og.titulo ?? title, og.subtitulo ?? description ?? "", og.kicker ?? "");
  return {
    title,
    description,
    alternates: alternatesDe(lang, path, idiomas),
    openGraph: { type: "article", locale: htmlLang[lang], siteName: site.name, title: og.titulo ?? title, description, url: `${site.url}/${lang}${path}`, images },
    twitter: { card: "summary_large_image", title: og.titulo ?? title, description, images: images.map((i) => i.url) },
    ...(PRIVADAS.has(path) ? { robots: { index: false, follow: false } } : {}),
  };
}
