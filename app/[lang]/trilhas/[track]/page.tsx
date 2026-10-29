// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "@/components/Link";
import { DadosEstruturados } from "@/components/DadosEstruturados";
import { curso, migalhas } from "@/lib/dados-estruturados";
import { PodcastsRelacionados } from "@/components/podcast/Relacionados";
import { notFound } from "next/navigation";
import { CaixaDaAula } from "@/components/CaixaDaAula";
import { Markdown } from "@/components/Markdown";
import { SaveOffline } from "@/components/Offline";
import { Compartilhar } from "@/components/Compartilhar";
import { CertificadoDaTrilha } from "@/components/CertificadoDaTrilha";
import { PlanoDeEstudos } from "@/components/PlanoDeEstudos";
import { ContinuarTrilha, Sumario, TrackProgress } from "@/components/Progress";
import { originalLang, Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";
import { site } from "@/lib/site";
import { defaultLocale, fill, localePath, plural } from "@/i18n/config";
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

  const cor = capaDaTrilha(track.area);
  const emConstrucao = ready.length < items.length;

  return (
    <>
      <DadosEstruturados dados={[curso(lang, track), migalhas(lang, [[t.nav.disciplines, "/trilhas"], [t.areas[track.area][0], `/estantes/${track.area}`], [track.title, `/trilhas/${track.slug}`]])]} />
      {/* ── O alto: a capa do caderno, colada torta, e a ficha da trilha no papel pontilhado ── */}
      {/* No aplicativo este alto vira o topo bordô da trilha (veja "Caderno de Bolso" em globals.css). */}
      <section className="topo-da-trilha pont border-b-[3px] border-ink">
        <div className="mx-auto max-w-[78rem] px-4 pt-6 pb-14 sm:px-6 lg:px-8 max-md:pb-10">
          <nav aria-label={t.nav.disciplines} className="font-mono text-xs uppercase tracking-[0.1em] text-ink-soft">
            <Link href={to("/trilhas")} className="hover:text-prelo-texto">{t.nav.disciplines}</Link>
            {" / "}
            <Link href={to(`/estantes/${track.area}`)} className="hover:text-prelo-texto">{t.areas[track.area][0]}</Link>
          </nav>
          <div className="mt-8 grid items-center gap-12 md:grid-cols-[18rem_minmax(0,1fr)] lg:gap-14">
            <div aria-hidden className="caderno mx-auto aspect-[3/4] w-full max-w-[18rem] -rotate-[1.5deg] max-md:hidden" style={{ background: cor }}>
              <span className="flex justify-between pt-5 pr-5 pl-10 font-mono text-[0.7rem] uppercase tracking-[0.18em]">
                <span>{t.stages[track.stage]}</span>
              </span>
              <span className="etiqueta mx-5 mt-7 ml-10 block p-4">
                <span className="block font-mono text-[0.62rem] uppercase tracking-[0.16em] text-[#5a4e3c]">{t.tracks.notebookName}</span>
                <span className="mt-0.5 block text-[1.6rem] font-semibold leading-[1.05]">{track.title}</span>
                <span className="mt-3 block font-mono text-[0.62rem] uppercase tracking-[0.16em] text-[#5a4e3c]">{t.tracks.notebookClass}</span>
                <span className="block text-lg">{t.areas[track.area][0]}</span>
              </span>
              <span className="mt-auto flex items-end justify-between pr-5 pb-5 pl-10">
                <span className="font-mono text-xs uppercase">{plural(lang, items.length, t.common.lessons)}</span>
                <span className="carimbo h-[4.6rem] w-[4.6rem] rotate-12 border-[#e0837a] text-[0.55rem] text-[#e0837a]">
                  <span className="px-1">{emConstrucao ? t.tracks.underConstruction : t.tracks.freeStamp}</span>
                </span>
              </span>
            </div>

            <div className="min-w-0">
              <p className="rotulo">
                {t.tracks.trackKicker} · {t.areas[track.area][0]}
              </p>
              <div {...originalLang(track.translated)}>
                <h1 className="mt-3 text-[2.6rem] font-medium leading-none text-balance sm:text-6xl lg:text-[4.25rem]">{track.title}</h1>
                <p className="mt-4 max-w-[40rem] text-[1.35rem] leading-snug text-ink-soft">{track.summary}</p>
              </div>
              <Untranslated lang={lang} t={t} show={!track.translated} />
              <p className="mt-7 flex flex-wrap gap-2.5 font-mono text-xs uppercase">
                <span className="border-[1.5px] border-ink bg-folha px-3 py-2">{fill(t.tracks.ready, { a: ready.length, b: items.length })}</span>
                {minutes > 0 && <span className="border-[1.5px] border-ink bg-folha px-3 py-2">{fill(t.tracks.minutes, { n: minutes })}</span>}
                <span className="border-[1.5px] border-ink bg-folha px-3 py-2">{t.stages[track.stage]}</span>
                {emConstrucao && <span className="border-[1.5px] border-[#c21f16] bg-folha px-3 py-2 text-prelo-texto">{t.tracks.underConstruction}</span>}
              </p>
              {ready.length > 0 && (
                <div className="cartao-v mt-8 max-w-[42rem] p-5 sm:p-6">
                  <TrackProgress ids={ready.map((item) => item.id)} />
                  <div className="mt-4">
                    <ContinuarTrilha lessons={items} comecar={t.tracks.startFirst} continuar={t.tracks.resume} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── O corpo: o sumário na folha pautada e, ao lado, os quadros da trilha ── */}
      <div className="mx-auto grid max-w-[78rem] items-start gap-12 px-4 pt-14 pb-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:px-8 max-md:pt-9">
        <div className="min-w-0">
          {track.intro && (
            <div className="mb-10 max-w-3xl" {...originalLang(track.translated)}>
              <Markdown lang={lang}>{track.intro}</Markdown>
            </div>
          )}
          <h2 className="tarja">
            <span className="tarja-nome">{t.tracks.summaryTitle}</span>
            <span className="tarja-conta">{plural(lang, items.length, t.common.lessons)}</span>
          </h2>
          <div className="mt-6" {...originalLang(track.translated)}>
            <Sumario lessons={items} />
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            {questionCount >= 10 ? (
              <Link href={to(`/trilhas/${track.slug}/prova`)} className="botao botao-tinta">
                {t.tracks.exam}
              </Link>
            ) : (
              ready.length > 0 && <p className="font-sans text-sm text-ink-soft">{t.tracks.examNeed}</p>
            )}
          </div>
          {ready.length > 0 && (
            <p className="mt-6 font-sans text-sm">
              <a href={`/epub/${track.slug}.epub`} download className="font-semibold underline decoration-[#c21f16] underline-offset-4 hover:text-prelo-texto">
                {t.tracks.epub}
              </a>
              <span className="text-ink-soft"> · {t.tracks.epubHint}</span>
            </p>
          )}
          {ready.length > 0 && <SaveOffline paths={[to(`/trilhas/${track.slug}`), ...ready.map((item) => to(item.path))]} s={t.tracks} />}
          <Compartilhar url={`${site.url}${to(`/trilhas/${track.slug}`)}`} texto={`${t.compartilhar.trilha} ${track.title}`} s={t.compartilhar} />
          {ready.length > 0 && (
            <p className="mt-4 flex flex-wrap gap-x-5 gap-y-1 font-sans text-sm">
              <Link href={`${to("/caderno")}?abrir=${encodeURIComponent(ready.map((item) => item.path).join(","))}&titulo=${encodeURIComponent(track.title)}`} className="underline hover:text-prelo-texto">
                {t.tracks.studyInNotebook}
              </Link>
              <Link href={to("/estudo-em-grupo")} className="underline hover:text-prelo-texto">
                {t.tracks.studyGroup}
              </Link>
            </p>
          )}
          {ready.length > 0 && <CertificadoDaTrilha ids={ready.map((item) => item.id)} trilha={track.slug} titulo={track.title} s={t.tracks} />}
          {ready.length > 0 && <PlanoDeEstudos aulas={ready.map((item) => ({ id: item.id, path: item.path, title: item.title }))} trilha={track.title} temProva={questionCount >= 10} s={t.tracks} />}
        </div>

        <aside className="flex flex-col gap-8">
          {emConstrucao && (
            <section className="border-2 border-dashed border-ink bg-parchment p-6">
              <h2 className="font-mono text-xs uppercase tracking-[0.2em]">{t.tracks.underConstruction}</h2>
              <p className="mt-2.5 text-lg leading-snug">
                {fill(t.tracks.ready, { a: ready.length, b: items.length })}. {t.tracks.plannedHelp}
              </p>
              <Link href={`${to("/contribuir")}?trilha=${encodeURIComponent(track.slug)}`} className="mt-3 inline-block font-sans font-bold underline decoration-[#c21f16] underline-offset-4 hover:text-prelo-texto">
                {t.tracks.helpWrite} →
              </Link>
            </section>
          )}
          <CaixaDaAula t={t} lang={lang} area={track.area} />
          <PodcastsRelacionados disciplina={track.area} trilha={track.slug} />
        </aside>
      </div>
    </>
  );
}

const CAPAS = ["#6e1f1a", "#2f5d34", "#8a5f1c", "#1f1a14", "#c21f16", "#5a4e3c", "#23485c", "#6b3b5a"];
/** A mesma cor de capa da estante (components/DisciplineBrowser.tsx): a disciplina se reconhece de longe. */
const capaDaTrilha = (area: string) => CAPAS[[...area].reduce((soma, letra) => soma + letra.charCodeAt(0), 0) % CAPAS.length];
