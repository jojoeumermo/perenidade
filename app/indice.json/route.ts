import { areaName } from "@/lib/areas";
import { getBooks, getTracks } from "@/lib/content";
import type { SearchEntry } from "@/lib/search";
import { plainText } from "@/lib/text";

// Índice de busca gerado no build: um arquivo estático, sem banco de dados.
export const dynamic = "force-static";

export function GET() {
  const entries: SearchEntry[] = [];
  for (const track of getTracks()) {
    const area = areaName(track.area);
    entries.push({
      kind: "trilha",
      title: track.title,
      href: `/trilhas/${track.slug}`,
      area,
      context: track.level,
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
  for (const book of getBooks()) {
    entries.push({
      kind: "obra",
      title: book.title,
      href: `/acervo/${book.id}`,
      area: areaName(book.area),
      context: book.author,
      text: book.synopsis,
    });
  }
  return Response.json(entries);
}
