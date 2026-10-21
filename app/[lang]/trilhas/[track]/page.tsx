// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "next/link";
import { DadosEstruturados } from "@/components/DadosEstruturados";
import { curso, migalhas } from "@/lib/dados-estruturados";
import { PodcastsRelacionados } from "@/components/podcast/Relacionados";
import { notFound } from "next/navigation";
import { CaixaDaAula } from "@/components/CaixaDaAula";
import { Markdown } from "@/components/Markdown";
import { SaveOffline } from "@/components/Offline";
import { CertificadoDaTrilha } from "@/components/CertificadoDaTrilha";
import { PlanoDeEstudos } from "@/components/PlanoDeEstudos";
import { LessonList, TrackProgress } from "@/components/Progress";
import { originalLang, Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";
import { defaultLocale, fill, localePath } from "@/i18n/config";
import { getTrack, getTracks, idiomasDe } from "@/lib/content";
import { lessonId } from "@/lib/ids";
import { withLangs } from "@/lib/params";

export const dynamicParams = false;

export function generateStaticParams() {
  return withLangs(getTracks(defaultLocale).map((track) => ({ track: track.slug })));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/trilhas/[track]">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  const track = getTrack((await params).track, lang);
  return track ? paginaMeta(lang, `/trilhas/${track.slug}`, track.title, track.summary, { kicker: `${t.areas[track.area][0]} · ${t.stages[track.stage]}` }, { idiomas: idiomasDe(track.file) }) : {};
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
  const questionCount = track.lessons.reduce((sum, lesson) => sum + lesson.quiz.length, 0);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <DadosEstruturados dados={[curso(lang, track), migalhas(lang, [[t.nav.disciplines, "/trilhas"], [t.areas[track.area][0], `/estantes/${track.area}`], [track.title, `/trilhas/${track.slug}`]])]} />
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
      {ready.length < items.length && (
        <aside className="no-print mt-6 border-2 border-gold bg-parchment-deep p-4 font-sans text-sm">
          <p className="flex flex-wrap items-center gap-3">
            <span className="bg-gold px-2 py-0.5 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink">{t.tracks.underConstruction}</span>
            <span className="text-ink-soft">{fill(t.tracks.ready, { a: ready.length, b: items.length })}</span>
          </p>
          <div className="mt-3 h-2 w-full bg-parchment" role="progressbar" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={ready.length} aria-label={t.tracks.underConstruction}>
            <div className="h-2 bg-oxblood" style={{ width: `${Math.round((ready.length / Math.max(items.length, 1)) * 100)}%` }} />
          </div>
          <Link href={`${to("/contribuir")}?trilha=${encodeURIComponent(track.slug)}`} className="mt-3 inline-block border-2 border-ink px-4 py-2 font-medium hover:border-oxblood hover:text-oxblood">{t.tracks.helpWrite} →</Link>
        </aside>
      )}

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
        {questionCount >= 10 ? (
          <Link href={to(`/trilhas/${track.slug}/prova`)} className="ml-0 mt-4 inline-block border-2 border-ink px-8 py-2.5 font-sans text-sm font-medium hover:border-oxblood hover:text-oxblood sm:ml-4">
            {t.tracks.exam}
          </Link>
        ) : (
          ready.length > 0 && <p className="mt-4 font-sans text-sm text-ink-soft">{t.tracks.examNeed}</p>
        )}
        {ready.length > 0 && (
          <p className="mt-4 font-sans text-sm">
            <a href={`/epub/${track.slug}.epub`} download className="underline hover:text-oxblood">{t.tracks.epub}</a>
            <span className="text-ink-soft"> · {t.tracks.epubHint}</span>
          </p>
        )}
        {ready.length > 0 && <SaveOffline paths={[to(`/trilhas/${track.slug}`), ...ready.map((item) => to(item.path))]} s={t.tracks} />}
        {ready.length > 0 && (
          <p className="mt-4 flex flex-wrap gap-x-5 gap-y-1 font-sans text-sm">
            <Link href={`${to("/caderno")}?abrir=${encodeURIComponent(ready.map((item) => item.path).join(","))}&titulo=${encodeURIComponent(track.title)}`} className="underline hover:text-oxblood">{t.tracks.studyInNotebook}</Link>
            <Link href={to("/estudo-em-grupo")} className="underline hover:text-oxblood">{t.tracks.studyGroup}</Link>
          </p>
        )}
        {ready.length > 0 && <CertificadoDaTrilha ids={ready.map((item) => item.id)} trilha={track.slug} titulo={track.title} s={t.tracks} />}
        {ready.length > 0 && <PlanoDeEstudos aulas={ready.map((item) => ({ id: item.id, path: item.path, title: item.title }))} trilha={track.title} temProva={questionCount >= 10} s={t.tracks} />}
        {ready.length < items.length && (
          <p className="mt-6 font-sans text-sm text-ink-soft">
            {t.tracks.plannedHelp}{" "}
            <Link href={`${to("/contribuir")}?trilha=${track.slug}`} className="underline hover:text-oxblood">{t.tracks.plannedLink}</Link>
          </p>
        )}
      </div>
      <CaixaDaAula t={t} lang={lang} area={track.area} />
      <PodcastsRelacionados disciplina={track.area} trilha={track.slug} />
    </div>
  );
}
