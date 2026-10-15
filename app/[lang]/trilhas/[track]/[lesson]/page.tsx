// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import GithubSlugger from "github-slugger";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CaixaDaAula } from "@/components/CaixaDaAula";
import { SourceList } from "@/components/Cards";
import { Markdown } from "@/components/Markdown";
import { CiteButton, CompleteButton, LessonList, RememberLesson } from "@/components/Progress";
import { Quiz } from "@/components/Quiz";
import { StudyTools } from "@/components/StudyTools";
import { originalLang, Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { defaultLocale, fill, htmlLang, localePath, plural } from "@/i18n/config";
import { getGlossary, getTrack, getTracks } from "@/lib/content";
import { fileHistory } from "@/lib/history";
import { lessonId } from "@/lib/ids";
import { withLangs } from "@/lib/params";
import { site } from "@/lib/site";

type Props = PageProps<"/[lang]/trilhas/[track]/[lesson]">;

export const dynamicParams = false;

export function generateStaticParams() {
  return withLangs(
    getTracks(defaultLocale).flatMap((track) => track.lessons.map((lesson) => ({ track: track.slug, lesson: lesson.slug }))),
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const { track: trackSlug, lesson: lessonSlug } = await params;
  const track = getTrack(trackSlug, lang);
  const lesson = track?.lessons.find((l) => l.slug === lessonSlug);
  return track && lesson ? { title: `${lesson.title} · ${track.title}`, description: lesson.summary } : {};
}

/** Subtítulos (##) da aula, com as mesmas âncoras que o texto recebe. */
function sections(body: string): { id: string; title: string }[] {
  const slugger = new GithubSlugger();
  return body
    .replace(/```[\s\S]*?```/g, "")
    .split("\n")
    .flatMap((line) => {
      const match = /^(#{2,3}) (.+)$/.exec(line);
      if (!match) return [];
      const title = match[2].replace(/[*_`]/g, "").trim();
      const id = slugger.slug(title);
      return match[1] === "##" ? [{ id, title }] : [];
    });
}

export default async function LessonPage({ params }: Props) {
  const { lang, t } = await loadLang(params);
  const { track: trackSlug, lesson: lessonSlug } = await params;
  const track = getTrack(trackSlug, lang);
  const index = track?.lessons.findIndex((l) => l.slug === lessonSlug) ?? -1;
  if (!track || index < 0) notFound();

  const to = (path: string) => localePath(lang, path);
  const path = (slug: string) => `/trilhas/${track.slug}/${slug}`;
  const lesson = track.lessons[index];
  const prev = track.lessons[index - 1];
  const next = track.lessons[index + 1];
  const id = lessonId(track.slug, lesson.slug);
  const history = fileHistory(lesson.file);
  const toc = sections(lesson.body);
  const updated = history.updated && new Intl.DateTimeFormat(htmlLang[lang], { timeZone: "UTC" }).format(new Date(history.updated));
  // O glossário só é ligado ao texto quando os dois estão no mesmo idioma.
  const terms = lesson.translated ? getGlossary(lang).filter((term) => term.translated).map(({ slug, term, summary }) => ({ slug, term, summary })) : [];
  const fix = `${to("/contribuir")}?corrigir=${encodeURIComponent(path(lesson.slug))}`;

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-[16rem_1fr]">
      <RememberLesson path={path(lesson.slug)} title={lesson.title} track={track.title} />

      <aside className="indice-da-trilha no-print no-focus font-sans text-sm md:sticky md:top-6 md:self-start">
        <Link href={to(`/estantes/${track.area}`)} className="text-ink-soft hover:text-oxblood">← {t.areas[track.area][0]}</Link>
        <h2 className="mt-3 font-serif text-xl font-semibold" {...originalLang(track.translated)}>
          <Link href={to(`/trilhas/${track.slug}`)} className="hover:text-oxblood">{track.title}</Link>
        </h2>
        <div className="mt-4" {...originalLang(track.translated)}>
          <LessonList
            currentId={id}
            lessons={track.plan.map((item) => ({ id: lessonId(track.slug, item.slug), path: path(item.slug), title: item.title, ready: item.ready }))}
          />
        </div>
        {toc.length > 1 && (
          <nav aria-label={t.lesson.inThisLesson} className="mt-8 hidden md:block" {...originalLang(lesson.translated)}>
            <p className="font-mono text-xs uppercase tracking-widest text-gold">{t.lesson.inThisLesson}</p>
            <ul className="mt-3 space-y-1.5 text-ink-soft">
              {toc.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`} className="hover:text-oxblood">{section.title}</a>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </aside>

      <article className="min-w-0 max-w-prose">
        <p className="font-mono text-xs text-gold">
          {t.areas[track.area][0]} · {t.stages[track.stage]} · {fill(t.lesson.position, { i: index + 1, n: track.lessons.length })} ·{" "}
          {fill(t.tracks.minutes, { n: lesson.minutes })}
        </p>
        <div {...originalLang(lesson.translated)}>
          <h1 className="mt-2 text-4xl font-semibold sm:text-5xl">{lesson.title}</h1>
          <p className="mt-3 text-xl italic text-ink-soft">{lesson.summary}</p>
        </div>

        <Untranslated lang={lang} t={t} show={!lesson.translated} />
        {!lesson.reviewed && (
          <p className="no-print mt-6 border-l-2 border-gold pl-4 font-sans text-sm text-ink-soft">
            {t.lesson.awaitingReview} <Link href={fix} className="underline hover:text-oxblood">{t.lesson.suggestOne}</Link>.
          </p>
        )}

        <div {...originalLang(lesson.translated)}>
          <div id="texto-da-aula" className="mt-8">
            <Markdown lang={lang} terms={terms} tryCode={t.lesson.tryCode}>{lesson.body}</Markdown>
          </div>
          {lesson.quiz.length > 0 && <Quiz key={id} questions={lesson.quiz} />}
          <SourceList sources={lesson.sources} title={t.lesson.sources} />
        </div>

        <CompleteButton id={id} next={next && { path: path(next.slug), title: next.title }} />

        <nav aria-label={t.lesson.neighbors} className="no-print mt-12 flex justify-between gap-6 border-t border-rule pt-6 font-sans text-sm">
          {prev ? <Link href={to(path(prev.slug))} data-prev className="hover:text-oxblood">← {prev.title}</Link> : <span />}
          {next ? <Link href={to(path(next.slug))} data-next className="text-right hover:text-oxblood">{next.title} →</Link> : <span />}
        </nav>

        <StudyTools id={id} path={path(lesson.slug)} s={t.study} />

        <footer className="mt-8 space-y-2 font-mono text-xs text-ink-soft">
          <p>
            {lesson.authors.length > 0 && <>{fill(t.lesson.by, { names: lesson.authors.join(", ") })} · </>}
            {updated
              ? `${fill(t.lesson.lastChange, { date: updated })} · ${plural(lang, history.revisions, t.lesson.saved)}`
              : t.lesson.noHistory}{" "}
            · {t.lesson.license}
          </p>
          <p className="no-print flex flex-wrap gap-x-5 gap-y-1">
            <Link href={fix} className="underline hover:text-oxblood">{t.common.suggestFix}</Link>
            <a href={to(`${path(lesson.slug)}/texto`)} className="underline hover:text-oxblood">{t.lesson.plainText}</a>
            <CiteButton citation={`${lesson.authors.join(", ") || site.name}. “${lesson.title}”. ${track.title}. ${site.name}.`} />
            <Link href={to(`/denunciar?item=${encodeURIComponent(path(lesson.slug))}`)} className="underline hover:text-oxblood">
              {t.common.report}
            </Link>
          </p>
          <p className="no-print hidden md:block">{t.lesson.keys}</p>
        </footer>
      </article>
      <CaixaDaAula t={t} lang={lang} area={track.area} sugeridas={lesson.tools} />
    </div>
  );
}
