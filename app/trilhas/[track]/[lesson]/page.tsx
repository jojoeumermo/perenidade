import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/Markdown";
import { CompleteButton, LessonList, RememberLesson } from "@/components/Progress";
import { Quiz } from "@/components/Quiz";
import { areaName } from "@/lib/areas";
import { getTrack, getTracks } from "@/lib/content";
import { lessonId } from "@/lib/ids";
import { fileHistory } from "@/lib/history";
import { github } from "@/lib/site";
import { formatDate } from "@/lib/text";

export const dynamicParams = false;

export function generateStaticParams() {
  return getTracks().flatMap((track) => track.lessons.map((lesson) => ({ track: track.slug, lesson: lesson.slug })));
}

export async function generateMetadata({ params }: PageProps<"/trilhas/[track]/[lesson]">): Promise<Metadata> {
  const { track: trackSlug, lesson: lessonSlug } = await params;
  const track = getTrack(trackSlug);
  const lesson = track?.lessons.find((l) => l.slug === lessonSlug);
  return track && lesson ? { title: `${lesson.title} · ${track.title}`, description: lesson.summary } : {};
}

export default async function LessonPage({ params }: PageProps<"/trilhas/[track]/[lesson]">) {
  const { track: trackSlug, lesson: lessonSlug } = await params;
  const track = getTrack(trackSlug);
  const index = track?.lessons.findIndex((l) => l.slug === lessonSlug) ?? -1;
  if (!track || index < 0) notFound();

  const href = (slug: string) => `/trilhas/${track.slug}/${slug}`;
  const lesson = track.lessons[index];
  const prev = track.lessons[index - 1];
  const next = track.lessons[index + 1];
  const id = lessonId(track.slug, lesson.slug);
  const history = fileHistory(lesson.file);
  const external = { target: "_blank", rel: "noopener noreferrer", className: "underline hover:text-oxblood" };

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-[16rem_1fr]">
      <RememberLesson href={href(lesson.slug)} title={lesson.title} track={track.title} />

      <aside className="no-print font-sans text-sm md:sticky md:top-6 md:self-start">
        <Link href="/trilhas" className="text-ink-soft hover:text-oxblood">← Trilhas</Link>
        <h2 className="mt-3 font-serif text-xl font-semibold">
          <Link href={`/trilhas/${track.slug}`} className="hover:text-oxblood">{track.title}</Link>
        </h2>
        <div className="mt-4">
          <LessonList
            currentId={id}
            lessons={track.lessons.map((l) => ({ id: lessonId(track.slug, l.slug), href: href(l.slug), title: l.title }))}
          />
        </div>
      </aside>

      <article className="min-w-0 max-w-prose">
        <p className="font-mono text-xs text-gold">
          {areaName(track.area)} · aula {index + 1} de {track.lessons.length} · ~{lesson.minutes} min de leitura
        </p>
        <h1 className="mt-2 text-4xl font-semibold sm:text-5xl">{lesson.title}</h1>
        <p className="mt-3 text-xl italic text-ink-soft">{lesson.summary}</p>

        {!lesson.reviewed && (
          <p className="no-print mt-6 border-l-2 border-gold pl-4 font-sans text-sm text-ink-soft">
            Esta aula ainda aguarda revisão da comunidade. Achou um erro?{" "}
            <a href={github.edit(lesson.file)} {...external}>Sugira uma correção</a>.
          </p>
        )}

        <div className="mt-8">
          <Markdown>{lesson.body}</Markdown>
        </div>

        {lesson.quiz.length > 0 && <Quiz key={id} questions={lesson.quiz} />}

        <CompleteButton id={id} next={next && { href: href(next.slug), title: next.title }} />

        <nav aria-label="Aulas vizinhas" className="no-print mt-12 flex justify-between gap-6 border-t border-rule pt-6 font-sans text-sm">
          {prev ? <Link href={href(prev.slug)} className="hover:text-oxblood">← {prev.title}</Link> : <span />}
          {next ? <Link href={href(next.slug)} className="text-right hover:text-oxblood">{next.title} →</Link> : <span />}
        </nav>

        <footer className="mt-8 space-y-2 font-mono text-xs text-ink-soft">
          <p>
            {lesson.authors.length > 0 && <>Por {lesson.authors.join(", ")} · </>}
            {history.updated ? (
              <>
                Última alteração em {formatDate(history.updated)} · {history.revisions}{" "}
                {history.revisions === 1 ? "versão guardada" : "versões guardadas"}
              </>
            ) : (
              "Ainda sem histórico publicado"
            )}{" "}
            · Licença CC BY-SA 4.0
          </p>
          <p className="no-print flex flex-wrap gap-x-5 gap-y-1">
            <a href={github.history(lesson.file)} {...external}>Ver todas as versões</a>
            <a href={github.edit(lesson.file)} {...external}>Sugerir correção</a>
            <Link href={`/denunciar?item=${encodeURIComponent(href(lesson.slug))}`} className="underline hover:text-oxblood">Denunciar</Link>
          </p>
        </footer>
      </article>
    </div>
  );
}
