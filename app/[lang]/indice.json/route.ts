import { loadLang } from "@/i18n";
import { locales } from "@/i18n/config";
import { getAuthors, getBooks, getTracks, getTributes } from "@/lib/content";
import type { SearchEntry } from "@/lib/search";
import { plainText } from "@/lib/text";

// Índice de busca gerado no build: um arquivo estático por idioma, sem banco de dados.
// Como traz o texto completo, também serve de cópia de segurança do acervo.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function GET(_request: Request, { params }: RouteContext<"/[lang]/indice.json">) {
  const { lang, t } = await loadLang(params);
  const entries: SearchEntry[] = [];
  for (const track of getTracks(lang)) {
    const area = t.areas[track.area][0];
    entries.push({
      kind: "trilha",
      title: track.title,
      href: `/trilhas/${track.slug}`,
      area,
      context: t.levels[track.level],
      text: `${track.summary} ${plainText(track.intro)}`,
    });
    for (const lesson of track.lessons) {
      entries.push({
        kind: "aula",
        title: lesson.title,
        href: `/trilhas/${track.slug}/${lesson.slug}`,
        area,
        context: track.title,
        text: `${lesson.summary} ${plainText(lesson.body)}`,
      });
    }
  }
  for (const book of getBooks(lang)) {
    entries.push({
      kind: "obra",
      title: book.title,
      href: `/acervo/${book.id}`,
      area: t.areas[book.area][0],
      context: book.author,
      text: book.synopsis,
    });
  }
  for (const author of getAuthors(lang)) {
    entries.push({ kind: "autor", title: author.name, href: `/autores#${author.slug}`, area: "", context: author.years, text: author.bio });
  }
  for (const tribute of getTributes(lang)) {
    entries.push({
      kind: "memorial",
      title: tribute.name,
      href: `/memorial#${tribute.slug}`,
      area: "",
      context: `${tribute.born} – ${tribute.died}`,
      text: tribute.body,
    });
  }
  return Response.json(entries);
}
