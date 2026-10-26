// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { defaultLocale, htmlLang, type Locale, locales } from "@/i18n/config";
import { site } from "@/lib/site";

/** Páginas que não entram nos buscadores: só fazem sentido para quem está usando o site naquele momento. */
// O Mural de Saúde mostra nome, registro e contato de pessoas: fica fora dos buscadores (e do sitemap) até a
// revisão jurídica decidir o contrário. O texto público do termo (/saude/termo) não tem dado pessoal e continua indexado.
const PRIVADAS = new Set(["/busca", "/denunciar", "/reforco", "/meus-dados", "/certificado", "/entrar", "/painel", "/fora-do-ar", "/apoie/anterior", "/saude"]);

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

/** A imagem de compartilhamento gerada para esta página (app/api/og), com a identidade do instituto. */
export function ogDe(lang: Locale, titulo: string, subtitulo = "", kicker = "") {
  const q = new URLSearchParams({ l: lang, t: titulo.slice(0, 120), s: subtitulo.slice(0, 160), k: kicker.slice(0, 60) });
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
