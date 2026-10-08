// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
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
  const items = track.plan.map((item) => ({
    id: lessonId(track.slug, item.slug),
    path: `/trilhas/${track.slug}/${item.slug}`,
    title: item.title,
    ready: item.ready,
  }));
  const ready = items.filter((item) => item.ready);
  const minutes = track.lessons.reduce((sum, lesson) => sum + lesson.minutes, 0);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Link href={to(`/estantes/${track.area}`)} className="font-sans text-sm text-ink-soft hover:text-oxblood">← {t.areas[track.area][0]}</Link>
      <p className="mt-6 font-mono text-xs uppercase tracking-[0.3em] text-gold">
        {t.stages[track.stage]} · {fill(t.tracks.ready, { a: ready.length, b: items.length })}
        {minutes > 0 && ` · ${fill(t.tracks.minutes, { n: minutes })}`}
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
        {ready.length > 0 && (
          <div className="mt-4">
            <TrackProgress ids={ready.map((item) => item.id)} />
          </div>
        )}
        <div className="mt-5" {...originalLang(track.translated)}>
          <LessonList lessons={items} />
        </div>
        {ready[0] && (
          <Link href={to(ready[0].path)} className="mt-6 inline-block bg-ink px-8 py-3 font-sans text-sm font-medium text-parchment hover:bg-oxblood">
            {t.tracks.startFirst}
          </Link>
        )}
        {ready.length < items.length && (
          <p className="mt-6 font-sans text-sm text-ink-soft">
            {t.tracks.plannedHelp}{" "}
            <Link href={`${to("/contribuir")}?trilha=${track.slug}`} className="underline hover:text-oxblood">{t.tracks.plannedLink}</Link>
          </p>
        )}
      </div>
    </div>
  );
}
