// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { defaultLocale, isLocale } from "@/i18n/config";
import { getTrack, getTracks } from "@/lib/content";
import { nosIdiomasDoTexto } from "@/lib/params";
import { site } from "@/lib/site";

// A aula em texto puro, gerada no build nos idiomas em que o texto existe (as outras versões, na primeira visita). Serve para conexões fracas, leitores de tela simples
// e para quem prefere o terminal: curl <endereço da aula>/texto
export const dynamic = "force-static";
export const dynamicParams = true;

export function generateStaticParams() {
  return nosIdiomasDoTexto(
    getTracks(defaultLocale).flatMap((track) => track.lessons.map((lesson) => ({ params: { track: track.slug, lesson: lesson.slug }, file: lesson.file }))),
  );
}

export async function GET(_request: Request, { params }: RouteContext<"/[lang]/trilhas/[track]/[lesson]/texto">) {
  const { lang, track: trackSlug, lesson: lessonSlug } = await params;
  const track = isLocale(lang) ? getTrack(trackSlug, lang) : undefined;
  const lesson = track?.lessons.find((l) => l.slug === lessonSlug);
  if (!track || !lesson) return new Response("404\n", { status: 404 });

  const body = [
    `${lesson.title}`,
    `${track.title} · ${site.name}`,
    "",
    lesson.summary,
    "",
    lesson.body,
    "",
    "---",
    `${lesson.authors.join(", ") || site.name} · CC BY-SA 4.0`,
    "",
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
