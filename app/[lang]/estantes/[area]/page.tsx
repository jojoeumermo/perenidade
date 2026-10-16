// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "next/link";
import { PodcastsRelacionados } from "@/components/podcast/Relacionados";
import { VideoaulasDaDisciplina } from "@/components/VideoaulasPublicas";
import { notFound } from "next/navigation";
import { CaixaDaAula } from "@/components/CaixaDaAula";
import { BookCard, TrackCard } from "@/components/Cards";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { localePath, plural } from "@/i18n/config";
import { areaSlugs, areaTools, isArea, stages } from "@/lib/areas";
import { getBooks, getCatalog, getLooseMaterials, getTracks, getVideos, looseFormats } from "@/lib/content";
import { withLangs } from "@/lib/params";

export const dynamicParams = false;

export function generateStaticParams() {
  return withLangs(areaSlugs.map((area) => ({ area })));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/estantes/[area]">): Promise<Metadata> {
  const { t } = await loadLang(params);
  const { area } = await params;
  return isArea(area) ? { title: t.areas[area][0], description: t.areas[area][1] } : {};
}

export default async function Shelf({ params }: PageProps<"/[lang]/estantes/[area]">) {
  const { lang, t } = await loadLang(params);
  const { area } = await params;
  if (!isArea(area)) notFound();

  const to = (path: string) => localePath(lang, path);
  const tracks = getTracks(lang).filter((track) => track.area === area);
  const books = getBooks(lang).filter((book) => book.area === area);
  const catalog = getCatalog(area);
  const videos = getVideos(lang).filter((video) => video.area === area);
  const loose = getLooseMaterials(lang).filter((material) => material.area === area);
  const toolIds = areaTools[area] ?? [];
  const heading = "mt-12 border-b border-rule pb-3 text-3xl font-semibold";

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <Link href={to("/trilhas")} className="font-sans text-sm text-ink-soft hover:text-oxblood">← {t.tracks.title}</Link>
      <div className="mt-6">
        <PageHeading eyebrow={t.shelf.eyebrow} title={t.areas[area][0]}>
          {t.areas[area][1]}
        </PageHeading>
      </div>

      {/* As partes da disciplina: as trilhas (o caminho principal) e, ao lado, o que os educadores secundários publicam fora delas. */}
      <nav aria-label={t.shelf.sections} className="mt-8 flex flex-wrap gap-2 font-sans text-sm">
        <a href="#trilhas" className="border-2 border-ink bg-ink px-3 py-1.5 font-semibold text-parchment hover:bg-oxblood">{t.shelf.tracks}</a>
        <a href="#materiais-avulsos" className="border-2 border-ink px-3 py-1.5 font-semibold hover:border-oxblood hover:text-oxblood">
          {t.shelf.loose} <span className="font-mono text-xs">({loose.length})</span>
        </a>
        <a href="#aulas-em-video" className="border-2 border-ink px-3 py-1.5 font-semibold hover:border-oxblood hover:text-oxblood">{t.videoLessons.title}</a>
        <a href="#obras" className="border-2 border-ink px-3 py-1.5 font-semibold hover:border-oxblood hover:text-oxblood">{t.shelf.works}</a>
      </nav>

      {toolIds.length > 0 && (
        <p className="mt-6 flex flex-wrap items-baseline gap-x-4 gap-y-1 font-sans text-sm">
          <span className="font-mono text-xs uppercase tracking-widest text-gold">{t.shelf.tools}</span>
          {toolIds.map((id) => (
            <Link key={id} href={to(`/ferramentas/${id}`)} className="underline hover:text-oxblood">
              {(t.toolNames as Record<string, string[]>)[id][0]}
            </Link>
          ))}
        </p>
      )}

      {/* As trilhas seguem a ordem do currículo comum: fundamental, médio e superior. */}
      <span id="trilhas" className="block scroll-mt-6" />
      {stages.map((stage) => {
        const inStage = tracks.filter((track) => track.stage === stage);
        return (
          <section key={stage} id={stage} className="scroll-mt-6">
            <h2 className={heading}>{t.stages[stage]}</h2>
            {inStage.length > 0 ? (
              <div className="mt-6 grid gap-5 md:grid-cols-2">
                {inStage.map((track) => (
                  <TrackCard key={track.slug} track={track} lang={lang} t={t} />
                ))}
              </div>
            ) : (
              <p className="mt-6 text-lg text-ink-soft">
                {t.shelf.noTracks} <Link href={to("/contribuir")} className="underline hover:text-oxblood">{t.shelf.writeFirst}</Link>
              </p>
            )}
          </section>
        );
      })}

      <section id="materiais-avulsos" className="scroll-mt-6">
        <h2 className={heading}>{t.shelf.loose}</h2>
        <p className="mt-3 max-w-3xl text-ink-soft">{t.shelf.looseLead}</p>
        {loose.length > 0 ? (
          <ul className="mt-6 grid gap-4 font-sans text-sm md:grid-cols-2">
            {loose.map((material) => (
              <li key={material.slug} className="border border-rule bg-parchment-deep p-5">
                <p className="font-mono text-xs text-gold">
                  {t.loose.formats[looseFormats.indexOf(material.format)] ?? material.format} · {material.authors.join(", ")}
                </p>
                <Link href={to(`/avulsos/${material.slug}`)} className="mt-1 block font-serif text-xl font-semibold hover:text-oxblood">
                  {material.title}
                </Link>
                <p className="mt-1 text-ink-soft">{material.summary}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-lg text-ink-soft">
            {t.shelf.looseEmpty} <Link href={to("/voluntarios")} className="underline hover:text-oxblood">{t.shelf.looseJoin}</Link>
          </p>
        )}
      </section>

      {/* Aulas em vídeo gravadas pelos educadores da disciplina, lidas do serviço na hora. */}
      <VideoaulasDaDisciplina disciplina={area} s={t.videoLessons} />

      {/* Episódios do podcast ligados a esta disciplina: aparecem só se houver. */}
      <PodcastsRelacionados disciplina={area} />

      {videos.length > 0 && (
        <section>
          <h2 className={heading}>{t.shelf.videos}</h2>
          <ul className="mt-6 grid gap-4 font-sans text-sm md:grid-cols-2">
            {videos.map((video) => (
              <li key={video.slug} className="border border-rule bg-parchment-deep p-5">
                <p className="font-mono text-xs text-gold">{video.channel} · {video.language}</p>
                <a href={video.url} target="_blank" rel="noopener noreferrer" className="mt-1 block font-serif text-xl font-semibold hover:text-oxblood">{video.title} ↗</a>
                <p className="mt-1 text-ink-soft" lang="pt-BR">{video.description}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section id="obras" className="scroll-mt-6">
        <h2 className={heading}>{t.shelf.works}</h2>
        {books.length > 0 ? (
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {books.map((book) => (
              <BookCard key={book.id} book={book} lang={lang} t={t} />
            ))}
          </div>
        ) : (
          catalog.length === 0 && (
            <p className="mt-6 text-lg text-ink-soft">
              {t.shelf.noWorks} <Link href={to("/contribuir")} className="underline hover:text-oxblood">{t.shelf.suggestWork}</Link>
            </p>
          )
        )}
        {catalog.length > 0 && (
          <details className="mt-8 border border-rule bg-parchment-deep p-5">
            <summary className="cursor-pointer font-sans text-sm font-semibold">
              {t.library.catalogTitle} ({plural(lang, catalog.length, t.common.works)})
            </summary>
            <p className="mt-3 font-sans text-sm text-ink-soft">{t.library.catalogLead}</p>
            <ul className="mt-4 space-y-1.5 font-sans text-sm">
              {catalog.map((entry) => (
                <li key={entry.u}>
                  <a href={entry.u} target="_blank" rel="noopener noreferrer" className="underline hover:text-oxblood">{entry.t}</a>
                  <span className="text-ink-soft"> · {entry.a} · {entry.i} · {entry.f}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
      <CaixaDaAula t={t} lang={lang} area={area} />
    </div>
  );
}
