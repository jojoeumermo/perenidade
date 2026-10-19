// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "next/link";
import { TrackCard } from "@/components/Cards";
import { DailyQuote } from "@/components/DailyQuote";
import { NesteDia } from "@/components/NesteDia";
import { ContinueCard } from "@/components/Progress";
import { loadLang } from "@/i18n";
import { fill, htmlLang, localePath, plural } from "@/i18n/config";
import { essential, groups, type Stage, stages } from "@/lib/areas";
import { getBooks, getCatalog, getQuestions, getQuotes, getTracks } from "@/lib/content";
import { describePart, overview, publicHistory } from "@/lib/history";
import { alternatesDe } from "@/lib/seo";
import { site } from "@/lib/site";
import { DisciplineBrowser, type DisciplineGroup } from "@/components/DisciplineBrowser";

// A página inicial herda título e descrição do layout; aqui entram o endereço canônico e as versões em cada idioma.
export async function generateMetadata({ params }: PageProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  return { alternates: alternatesDe(lang, "") };
}

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang, t } = await loadLang(params);
  const h = t.home;
  const to = (path: string) => localePath(lang, path);
  const tracks = getTracks(lang);
  const books = getBooks(lang);
  const lessons = tracks.reduce((sum, track) => sum + track.lessons.length, 0);
  const works = books.length + groups.flatMap((group) => group.areas).reduce((sum, area) => sum + getCatalog(area).length, 0);
  const recent = publicHistory(site.historyFrom, lang)
    .slice(0, 3)
    .map((change) => ({ date: change.date, parts: overview(change.parts) }));
  const date = new Intl.DateTimeFormat(htmlLang[lang], { timeZone: "UTC" });
  const shelves: DisciplineGroup[] = groups.map((group) => ({
    id: group.id,
    title: t.groups[group.id],
    areas: group.areas.map((slug) => {
      const counts = Object.fromEntries(stages.map((stage) => [stage, [0, 0]])) as Record<Stage, [number, number]>;
      for (const track of tracks) {
        if (track.area !== slug) continue;
        counts[track.stage][0] += track.lessons.length;
        counts[track.stage][1] += track.plan.length;
      }
      return { slug, name: t.areas[slug][0], description: t.areas[slug][1], essential: essential.includes(slug), counts };
    }),
  }));
  const started = tracks.filter((track) => track.lessons.length > 0).sort((a, b) => b.lessons.length - a.lessons.length);
  const questions = getQuestions().slice(0, 4);
  const suggestions = started.slice(0, 3);
  const shortcuts: [string, string, string][] = [
    [t.nav.start, "/comecar", "M12 3v18M5 10l7-7 7 7"],
    [t.nav.journal, "/jornal", "M4 5h13v14H6a2 2 0 0 1-2-2zM17 9h3v8a2 2 0 0 1-2 2M7.5 9h6M7.5 12.5h6M7.5 16h3.5"],
    [t.nav.radio, "/radio", "M3 9h18v11H3zM7 9l10-5M8.5 12a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5M14 13h4M14 16h4"],
    [t.nav.tools, "/ferramentas", "M14.5 6.5a4 4 0 0 0-5.3 5.3L4 17v3h3l5.2-5.2a4 4 0 0 0 5.3-5.3l-2.6 2.6-2.4-.6-.6-2.4z"],
  ];

  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pt-16 pb-12 text-center max-md:pt-5 max-md:pb-4 max-md:text-left">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold max-md:text-[0.65rem] max-md:tracking-[0.2em]">{h.eyebrow}</p>
        <h1 className="mt-5 text-5xl font-semibold leading-[1.05] max-md:mt-2 max-md:text-[2.5rem] max-md:leading-[1.02] max-md:tracking-tight sm:text-7xl">
          {h.h1a}
          <br />
          <span className="italic text-oxblood">{h.h1b}</span>
          {h.h1c}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-xl text-ink-soft max-md:hidden">{h.lead}</p>
        <form action={to("/busca")} role="search" className="mx-auto mt-10 flex max-w-2xl border-2 border-ink bg-parchment-deep max-md:mt-4">
          <input
            name="q"
            type="search"
            aria-label={h.searchLabel}
            placeholder={h.searchPlaceholder}
            className="min-w-0 flex-1 bg-transparent px-4 py-3 font-mono text-sm outline-none placeholder:text-ink-soft sm:px-5 sm:py-4 sm:text-base"
          />
          <button className="cursor-pointer bg-ink px-6 font-sans text-sm font-medium text-parchment hover:bg-oxblood sm:px-8 sm:text-base">{h.searchButton}</button>
        </form>
        {/* Por onde ir, para quem chega sem saber o que procurar: as trilhas com mais aulas prontas e o guia de começo. */}
        {suggestions.length > 0 && (
          <p className="mx-auto mt-3 flex max-w-2xl flex-wrap items-center justify-center gap-x-3 gap-y-1 font-sans text-sm max-md:hidden">
            <span className="text-ink-soft">{h.tryLabel}</span>
            {suggestions.map((track) => (
              <Link key={track.slug} href={to(`/trilhas/${track.slug}`)} className="underline decoration-rule underline-offset-4 hover:text-oxblood hover:decoration-gold">
                {track.title}
              </Link>
            ))}
            <Link href={to("/comecar")} className="font-medium text-oxblood underline underline-offset-4 hover:text-ink">
              {t.nav.start}
            </Link>
          </p>
        )}
        <p className="mt-5 font-mono text-xs text-ink-soft max-md:mt-3 max-md:text-[0.7rem]">
          {plural(lang, groups.flatMap((group) => group.areas).length, t.common.disciplines)} · {plural(lang, lessons, t.common.lessons)} ·{" "}
          {plural(lang, works, t.common.works)} {h.indexed}
        </p>
        {/* Só no celular: quatro atalhos ao alcance do polegar para o que mais se abre no dia a dia. */}
        <nav aria-label={t.nav.more} className="mt-5 hidden grid-cols-4 gap-2 text-center font-sans text-xs max-md:grid">
          {shortcuts.map(([label, path, icon]) => (
            <Link key={path} href={to(path)} className="flex min-h-[4.5rem] flex-col items-center justify-center gap-1.5 border-[1.5px] border-t-4 border-ink border-t-[#c21f16] bg-parchment-deep px-1 py-2 font-semibold leading-tight">
              <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6 text-oxblood" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d={icon} />
              </svg>
              <span className="line-clamp-2">{label}</span>
            </Link>
          ))}
        </nav>
      </section>

      <ContinueCard />

      <section className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="text-4xl font-semibold">{h.shelves}</h2>
        <p className="mt-2 text-lg text-ink-soft">{h.shelvesHint}</p>
        <DisciplineBrowser labels groups={shelves} s={t.tracks} stageNames={t.stages} />
      </section>

      <DailyQuote quotes={getQuotes()} />

      <NesteDia s={h} lang={lang} />

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
                <li key={change.date} className="flex-1 border-t-2 border-gold pt-3">
                  <p className="font-mono text-sm text-gold">
                    <time dateTime={change.date}>{date.format(new Date(change.date))}</time>
                  </p>
                  {/* Só as três primeiras linhas do resumo do dia; o resto está no histórico completo. */}
                  <p className="text-lg">
                    {change.parts.slice(0, 3).map((part) => describePart(part, lang, t)).join(" · ")}
                    {change.parts.length > 3 && ` · ${fill(t.history.more, { n: change.parts.length - 3 })}`}
                  </p>
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
