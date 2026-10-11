// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { MetadataRoute } from "next";
import { defaultLocale, htmlLang, locales } from "@/i18n/config";
import { areaSlugs, tools } from "@/lib/areas";
import { getArticles, getBooks, getTracks } from "@/lib/content";
import { site } from "@/lib/site";

// Mapa do site para os buscadores. Cada endereço aparece uma vez por idioma, com a indicação das
// versões nos outros idiomas (hreflang), para o buscador mostrar a versão certa a cada pessoa.
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    "",
    "/trilhas",
    "/acervo",
    "/jornal",
    "/noticias",
    "/comunidade",
    "/memorial",
    "/dedicatoria",
    "/contribuir",
    "/apoie",
    "/explorar",
    "/busca",
    "/autores",
    "/voluntarios",
    "/glossario",
    "/linha-do-tempo",
    "/ferramentas",
    "/checagens",
    "/debates",
    "/perguntas",
    "/comecar",
    "/guia",
    "/videos",
    "/mural",
    "/reforco",
    "/materiais",
    "/sobre",
    "/privacidade",
    "/termos",
    "/denunciar",
  ];
  for (const area of areaSlugs) paths.push(`/estantes/${area}`);
  for (const tool of tools) paths.push(`/ferramentas/${tool}`);
  for (const track of getTracks(defaultLocale)) {
    paths.push(`/trilhas/${track.slug}`);
    for (const lesson of track.lessons) paths.push(`/trilhas/${track.slug}/${lesson.slug}`);
  }
  for (const book of getBooks(defaultLocale)) paths.push(`/acervo/${book.id}`);
  for (const article of getArticles(defaultLocale)) paths.push(`/jornal/${article.slug}`);
  const modified = new Date();
  return paths.flatMap((path) => {
    const languages = { ...Object.fromEntries(locales.map((code) => [htmlLang[code], `${site.url}/${code}${path}`])), "x-default": `${site.url}/${defaultLocale}${path}` };
    return locales.map((lang) => ({
      url: `${site.url}/${lang}${path}`,
      lastModified: modified,
      changeFrequency: (path === "" || path === "/jornal" ? "daily" : "weekly") as "daily" | "weekly",
      priority: path === "" ? 1 : lang === defaultLocale ? 0.8 : 0.5,
      alternates: { languages },
    }));
  });
}
