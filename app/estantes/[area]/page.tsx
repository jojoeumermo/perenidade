import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookCard, TrackCard } from "@/components/Cards";
import { PageHeading } from "@/components/PageHeading";
import { areas } from "@/lib/areas";
import { getBooks, getTracks } from "@/lib/content";

export const dynamicParams = false;

export function generateStaticParams() {
  return areas.map((area) => ({ area: area.slug }));
}

export async function generateMetadata({ params }: PageProps<"/estantes/[area]">): Promise<Metadata> {
  const { area: slug } = await params;
  const area = areas.find((a) => a.slug === slug);
  return area ? { title: area.name, description: `Trilhas e obras livres de ${area.name}. ${area.blurb}` } : {};
}

export default async function Shelf({ params }: PageProps<"/estantes/[area]">) {
  const { area: slug } = await params;
  const area = areas.find((a) => a.slug === slug);
  if (!area) notFound();

  const tracks = getTracks().filter((t) => t.area === area.slug);
  const books = getBooks().filter((b) => b.area === area.slug);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <PageHeading eyebrow="Estante" title={area.name}>
        {area.blurb}
      </PageHeading>

      <h2 className="mt-12 border-b border-rule pb-3 text-3xl font-semibold">Trilhas</h2>
      {tracks.length > 0 ? (
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {tracks.map((track) => (
            <TrackCard key={track.slug} track={track} />
          ))}
        </div>
      ) : (
        <p className="mt-6 text-lg text-ink-soft">
          Ainda não há trilhas nesta estante.{" "}
          <Link href="/contribuir" className="underline hover:text-oxblood">Que tal escrever a primeira aula?</Link>
        </p>
      )}

      <h2 className="mt-12 border-b border-rule pb-3 text-3xl font-semibold">Obras do acervo</h2>
      {books.length > 0 ? (
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {books.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      ) : (
        <p className="mt-6 text-lg text-ink-soft">
          Nenhuma obra indexada ainda.{" "}
          <Link href="/contribuir" className="underline hover:text-oxblood">Indique uma obra livre.</Link>
        </p>
      )}
    </div>
  );
}
