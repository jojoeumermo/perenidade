import type { MetadataRoute } from "next";
import { areas } from "@/lib/areas";
import { getBooks, getTracks } from "@/lib/content";
import { site } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ["", "/trilhas", "/acervo", "/busca", "/contribuir", "/moderacao", "/historico", "/sobre", "/denunciar"];
  for (const area of areas) paths.push(`/estantes/${area.slug}`);
  for (const track of getTracks()) {
    paths.push(`/trilhas/${track.slug}`);
    for (const lesson of track.lessons) paths.push(`/trilhas/${track.slug}/${lesson.slug}`);
  }
  for (const book of getBooks()) paths.push(`/acervo/${book.id}`);
  return paths.map((path) => ({ url: `${site.url}${path}` }));
}
