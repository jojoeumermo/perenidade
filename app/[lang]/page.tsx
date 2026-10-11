// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import Link from "next/link";
import { TrackCard } from "@/components/Cards";
import { DailyQuote } from "@/components/DailyQuote";
import { ContinueCard } from "@/components/Progress";
import { loadLang } from "@/i18n";
import { htmlLang, localePath, plural } from "@/i18n/config";
import { groups } from "@/lib/areas";
import { getBooks, getCatalog, getQuestions, getQuotes, getTracks } from "@/lib/content";
import { getHistory } from "@/lib/history";

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang, t } = await loadLang(params);
  const h = t.home;
  const to = (path: string) => localePath(lang, path);
  const tracks = getTracks(lang);
  const books = getBooks(lang);
  const lessons = tracks.reduce((sum, track) => sum + track.lessons.length, 0);
  const works = books.length + groups.flatMap((group) => group.areas).reduce((sum, area) => sum + getCatalog(area).length, 0);
  const recent = getHistory().slice(0, 3);
  const date = new Intl.DateTimeFormat(htmlLang[lang], { timeZone: "UTC" });
  const started = tracks.filter((track) => track.lessons.length > 0).sort((a, b) => b.lessons.length - a.lessons.length);
  const questions = getQuestions().slice(0, 4);

  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pt-16 pb-12 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">{h.eyebrow}</p>
        <h1 className="mt-5 text-5xl font-semibold leading-[1.05] sm:text-7xl">
          {h.h1a}
          <br />
          <span className="italic text-oxblood">{h.h1b}</span>
          {h.h1c}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-xl text-ink-soft">{h.lead}</p>
        <form action={to("/busca")} role="search" className="mx-auto mt-10 flex max-w-xl border-2 border-ink bg-parchment-deep">
          <input
            name="q"
            type="search"
            aria-label={h.searchLabel}
            placeholder={h.searchPlaceholder}
            className="min-w-0 flex-1 bg-transparent px-4 py-3 font-mono text-sm outline-none placeholder:text-ink-soft"
          />
          <button className="cursor-pointer bg-ink px-6 font-sans text-sm font-medium text-parchment hover:bg-oxblood">{h.searchButton}</button>
        </form>
        <p className="mt-5 font-mono text-xs text-ink-soft">
          {plural(lang, groups.flatMap((group) => group.areas).length, t.common.disciplines)} · {plural(lang, lessons, t.common.lessons)} ·{" "}
          {plural(lang, works, t.common.works)} {h.indexed}
        </p>
      </section>

      <ContinueCard />

      <section className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="border-b border-rule pb-3 text-3xl font-semibold">{h.shelves}</h2>
        {groups.map((group) => (
          <div key={group.id} className="mt-8">
            <h3 className="font-mono text-xs uppercase tracking-[0.3em] text-gold">{t.groups[group.id]}</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.areas.map((slug) => {
                const inArea = tracks.filter((track) => track.area === slug);
                const ready = inArea.reduce((sum, track) => sum + track.lessons.length, 0);
                const areaWorks = books.filter((book) => book.area === slug).length + getCatalog(slug).length;
                const [name, blurb] = t.areas[slug];
                return (
                  <Link
                    key={slug}
                    href={to(`/estantes/${slug}`)}
                    className="group border border-rule bg-parchment-deep p-5 transition hover:-translate-y-0.5 hover:border-gold"
                  >
                    <p className="font-mono text-xs text-gold">
                      {plural(lang, ready, t.common.lessons)} · {plural(lang, areaWorks, t.common.works)}
                    </p>
                    <p className="mt-2 text-2xl font-semibold group-hover:text-oxblood">{name}</p>
                    <p className="mt-1 text-ink-soft">{blurb}</p>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      <DailyQuote quotes={getQuotes()} />

      {questions.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-10">
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-rule pb-3">
            <h2 className="text-3xl font-semibold">{h.questionsTitle}</h2>
            <Link href={to("/perguntas")} className="font-sans text-sm underline hover:text-oxblood">{h.seeAll}</Link>
          </div>
          <ul className="mt-6 grid gap-3 font-sans sm:grid-cols-2" lang="pt-BR">
            {questions.map((question, i) => (
              <li key={question.pergunta}>
                <Link href={`${to("/perguntas")}#p${i + 1}`} className="block border-l-2 border-gold py-1 pl-4 text-lg hover:text-oxblood">
                  {question.pergunta}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {started.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-10">
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-rule pb-3">
            <h2 className="text-3xl font-semibold">{h.startTrack}</h2>
            <Link href={to("/trilhas")} className="font-sans text-sm underline hover:text-oxblood">{h.seeAll}</Link>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {started.slice(0, 3).map((track) => (
              <TrackCard key={track.slug} track={track} lang={lang} t={t} />
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="border-b border-rule pb-3 text-3xl font-semibold">{h.wingsTitle}</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {h.wings.map(([title, description, path]) => (
            <Link key={path} href={to(path)} className="group border border-rule bg-parchment-deep p-6 hover:border-gold">
              <h3 className="text-2xl font-semibold group-hover:text-oxblood">{title}</h3>
              <p className="mt-1 text-ink-soft">{description}</p>
            </Link>
          ))}
        </div>
      </section>

      {recent.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-10">
          <div className="border border-rule bg-parchment-deep p-8">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-3xl font-semibold">{h.timelineTitle}</h2>
              <Link href={to("/historico")} className="font-sans text-sm underline hover:text-oxblood">{h.fullHistory}</Link>
            </div>
            <p className="mt-1 font-mono text-xs text-ink-soft">{h.timelineSub}</p>
            <ol className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-start">
              {recent.map((change) => (
                <li key={change.hash} className="flex-1 border-t-2 border-gold pt-3">
                  <p className="font-mono text-sm text-gold">{date.format(new Date(change.date))}</p>
                  <p className="text-lg" lang="pt-BR">{change.subject}</p>
                </li>
              ))}
              <li className="flex-1 border-t-2 border-dashed border-gold pt-3">
                <p className="font-mono text-sm text-gold">{h.soon}</p>
                <p className="text-lg">
                  <Link href={to("/contribuir")} className="underline hover:text-oxblood">{h.yourContribution}</Link>
                </p>
              </li>
            </ol>
          </div>
        </section>
      )}

      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-10 font-sans md:grid-cols-3">
        {h.pillars.map(([title, description]) => (
          <div key={title} className="border-l-2 border-gold pl-4">
            <h3 className="font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-ink-soft">{description}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 text-center">
        <h2 className="text-4xl font-semibold">{h.ctaTitle}</h2>
        <p className="mx-auto mt-3 max-w-xl text-lg text-ink-soft">{h.ctaText}</p>
        <Link href={to("/contribuir")} className="mt-6 inline-block bg-oxblood px-8 py-3 font-sans text-sm font-medium text-parchment hover:bg-ink">
          {h.ctaButton}
        </Link>
      </section>
    </>
  );
}
