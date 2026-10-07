import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/Markdown";
import { LessonList, TrackProgress } from "@/components/Progress";
import { originalLang, Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { defaultLocale, fill, localePath } from "@/i18n/config";
import { getTrack, getTracks } from "@/lib/content";
import { lessonId } from "@/lib/ids";
import { withLangs } from "@/lib/params";

export const dynamicParams = false;

export function generateStaticParams() {
  return withLangs(getTracks(defaultLocale).map((track) => ({ track: track.slug })));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/trilhas/[track]">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const track = getTrack((await params).track, lang);
  return track ? { title: track.title, description: track.summary } : {};
}

export default async function TrackPage({ params }: PageProps<"/[lang]/trilhas/[track]">) {
  const { lang, t } = await loadLang(params);
  const track = getTrack((await params).track, lang);
  if (!track) notFound();

  const to = (path: string) => localePath(lang, path);
  const lessons = track.lessons.map((lesson) => ({
    id: lessonId(track.slug, lesson.slug),
    path: `/trilhas/${track.slug}/${lesson.slug}`,
    title: lesson.title,
  }));
  const minutes = track.lessons.reduce((sum, lesson) => sum + lesson.minutes, 0);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Link href={to("/trilhas")} className="font-sans text-sm text-ink-soft hover:text-oxblood">← {t.tracks.back}</Link>
      <p className="mt-6 font-mono text-xs uppercase tracking-[0.3em] text-gold">
        <Link href={to(`/estantes/${track.area}`)} className="hover:text-oxblood">{t.areas[track.area][0]}</Link> ·{" "}
        {t.levels[track.level]} · {fill(t.tracks.minutes, { n: minutes })}
      </p>
      <div {...originalLang(track.translated)}>
        <h1 className="mt-2 text-4xl font-semibold sm:text-5xl">{track.title}</h1>
        <p className="mt-3 text-xl text-ink-soft">{track.summary}</p>
      </div>
      <Untranslated lang={lang} t={t} show={!track.translated} />

      {track.intro && (
        <div className="mt-8" {...originalLang(track.translated)}>
          <Markdown lang={lang}>{track.intro}</Markdown>
        </div>
      )}

      <div className="mt-10 border border-rule bg-parchment-deep p-6">
        <h2 className="text-2xl font-semibold">{t.tracks.lessonsTitle}</h2>
        <div className="mt-4">
          <TrackProgress ids={lessons.map((lesson) => lesson.id)} />
        </div>
        <div className="mt-5" {...originalLang(track.translated)}>
          <LessonList lessons={lessons} />
        </div>
        {lessons[0] && (
          <Link
            href={to(lessons[0].path)}
            className="mt-6 inline-block bg-ink px-8 py-3 font-sans text-sm font-medium text-parchment hover:bg-oxblood"
          >
            {t.tracks.startFirst}
          </Link>
        )}
      </div>
    </div>
  );
}
