import { defaultLocale, isLocale } from "@/i18n/config";
import { getTrack, getTracks } from "@/lib/content";
import { withLangs } from "@/lib/params";
import { site } from "@/lib/site";

// A aula em texto puro, gerada no build. Serve para conexões fracas, leitores de tela simples
// e para quem prefere o terminal: curl <endereço da aula>/texto
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return withLangs(
    getTracks(defaultLocale).flatMap((track) => track.lessons.map((lesson) => ({ track: track.slug, lesson: lesson.slug }))),
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
