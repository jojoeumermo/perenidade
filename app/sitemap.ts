import type { MetadataRoute } from "next";
import { defaultLocale, locales } from "@/i18n/config";
import { areaSlugs } from "@/lib/areas";
import { getBooks, getTracks } from "@/lib/content";
import { site } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    "",
    "/trilhas",
    "/acervo",
    "/autores",
    "/memorial",
    "/voluntarios",
    "/glossario",
    "/linha-do-tempo",
    "/busca",
    "/contribuir",
    "/moderacao",
    "/historico",
    "/sobre",
    "/meus-dados",
    "/denunciar",
  ];
  for (const area of areaSlugs) paths.push(`/estantes/${area}`);
  for (const track of getTracks(defaultLocale)) {
    paths.push(`/trilhas/${track.slug}`);
    for (const lesson of track.lessons) paths.push(`/trilhas/${track.slug}/${lesson.slug}`);
  }
  for (const book of getBooks(defaultLocale)) paths.push(`/acervo/${book.id}`);
  return locales.flatMap((lang) => paths.map((path) => ({ url: `${site.url}/${lang}${path}` })));
}
