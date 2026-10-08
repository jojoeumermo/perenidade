// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
import type { MetadataRoute } from "next";
import { defaultLocale, locales } from "@/i18n/config";
import { areaSlugs, tools } from "@/lib/areas";
import { getArticles, getBooks, getTracks } from "@/lib/content";
import { site } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    "",
    "/trilhas",
    "/acervo",
    "/jornal",
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
    "/guia",
    "/videos",
    "/historico",
    "/sobre",
    "/meus-dados",
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
  return locales.flatMap((lang) => paths.map((path) => ({ url: `${site.url}/${lang}${path}` })));
}
