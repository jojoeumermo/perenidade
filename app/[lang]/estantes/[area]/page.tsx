import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookCard, TrackCard } from "@/components/Cards";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { areaSlugs, type AreaSlug } from "@/lib/areas";
import { getBooks, getTracks } from "@/lib/content";
import { withLangs } from "@/lib/params";

export const dynamicParams = false;

export function generateStaticParams() {
  return withLangs(areaSlugs.map((area) => ({ area })));
}

const isArea = (value: string): value is AreaSlug => (areaSlugs as readonly string[]).includes(value);

export async function generateMetadata({ params }: PageProps<"/[lang]/estantes/[area]">): Promise<Metadata> {
  const { t } = await loadLang(params);
  const { area } = await params;
  return isArea(area) ? { title: t.areas[area][0], description: t.areas[area][1] } : {};
}

export default async function Shelf({ params }: PageProps<"/[lang]/estantes/[area]">) {
  const { lang, t } = await loadLang(params);
  const { area } = await params;
  if (!isArea(area)) notFound();

  const tracks = getTracks(lang).filter((track) => track.area === area);
  const books = getBooks(lang).filter((book) => book.area === area);
  const contribute = localePath(lang, "/contribuir");

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <PageHeading eyebrow={t.shelf.eyebrow} title={t.areas[area][0]}>
        {t.areas[area][1]}
      </PageHeading>

      <h2 className="mt-12 border-b border-rule pb-3 text-3xl font-semibold">{t.shelf.tracks}</h2>
      {tracks.length > 0 ? (
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {tracks.map((track) => (
            <TrackCard key={track.slug} track={track} lang={lang} t={t} />
          ))}
        </div>
      ) : (
        <p className="mt-6 text-lg text-ink-soft">
          {t.shelf.noTracks} <Link href={contribute} className="underline hover:text-oxblood">{t.shelf.writeFirst}</Link>
        </p>
      )}

      <h2 className="mt-12 border-b border-rule pb-3 text-3xl font-semibold">{t.shelf.works}</h2>
      {books.length > 0 ? (
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {books.map((book) => (
            <BookCard key={book.id} book={book} lang={lang} t={t} />
          ))}
        </div>
      ) : (
        <p className="mt-6 text-lg text-ink-soft">
          {t.shelf.noWorks} <Link href={contribute} className="underline hover:text-oxblood">{t.shelf.suggestWork}</Link>
        </p>
      )}
    </div>
  );
}
