import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/Markdown";
import { LessonList, TrackProgress } from "@/components/Progress";
import { areaName } from "@/lib/areas";
import { getTrack, getTracks } from "@/lib/content";
import { lessonId } from "@/lib/ids";

export const dynamicParams = false;

export function generateStaticParams() {
  return getTracks().map((track) => ({ track: track.slug }));
}

export async function generateMetadata({ params }: PageProps<"/trilhas/[track]">): Promise<Metadata> {
  const track = getTrack((await params).track);
  return track ? { title: track.title, description: track.summary } : {};
}

export default async function TrackPage({ params }: PageProps<"/trilhas/[track]">) {
  const track = getTrack((await params).track);
  if (!track) notFound();

  const lessons = track.lessons.map((lesson) => ({
    id: lessonId(track.slug, lesson.slug),
    href: `/trilhas/${track.slug}/${lesson.slug}`,
    title: lesson.title,
  }));
  const minutes = track.lessons.reduce((sum, l) => sum + l.minutes, 0);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Link href="/trilhas" className="font-sans text-sm text-ink-soft hover:text-oxblood">← Trilhas</Link>
      <p className="mt-6 font-mono text-xs uppercase tracking-[0.3em] text-gold">
        <Link href={`/estantes/${track.area}`} className="hover:text-oxblood">{areaName(track.area)}</Link> · {track.level} · ~{minutes} min de leitura
      </p>
      <h1 className="mt-2 text-4xl font-semibold sm:text-5xl">{track.title}</h1>
      <p className="mt-3 text-xl text-ink-soft">{track.summary}</p>

      {track.intro && (
        <div className="mt-8">
          <Markdown>{track.intro}</Markdown>
        </div>
      )}

      <div className="mt-10 border border-rule bg-parchment-deep p-6">
        <h2 className="text-2xl font-semibold">Aulas</h2>
        <div className="mt-4">
          <TrackProgress ids={lessons.map((l) => l.id)} />
        </div>
        <div className="mt-5">
          <LessonList lessons={lessons} />
        </div>
        {lessons[0] && (
          <Link
            href={lessons[0].href}
            className="mt-6 inline-block bg-ink px-8 py-3 font-sans text-sm font-medium text-parchment hover:bg-oxblood"
          >
            Começar pela primeira aula
          </Link>
        )}
      </div>
    </div>
  );
}
