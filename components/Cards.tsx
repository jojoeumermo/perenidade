import Link from "next/link";
import { areaName } from "@/lib/areas";
import type { Book, Track } from "@/lib/content";
import { lessonId } from "@/lib/ids";
import { TrackProgress } from "./Progress";

export function TrackCard({ track }: { track: Track }) {
  const count = track.lessons.length;
  return (
    <article className="flex flex-col border border-rule bg-parchment-deep p-6">
      <p className="font-mono text-xs text-gold">
        {areaName(track.area)} · {track.level} · {count} {count === 1 ? "aula" : "aulas"}
      </p>
      <h3 className="mt-2 text-2xl font-semibold">
        <Link href={`/trilhas/${track.slug}`} className="hover:text-oxblood">
          {track.title}
        </Link>
      </h3>
      <p className="mt-1 flex-1 text-ink-soft">{track.summary}</p>
      <div className="mt-5">
        <TrackProgress ids={track.lessons.map((l) => lessonId(track.slug, l.slug))} />
      </div>
    </article>
  );
}

export function BookCard({ book }: { book: Book }) {
  return (
    <article className="flex flex-col border border-rule bg-parchment-deep p-6">
      <p className="font-mono text-xs text-gold">
        {areaName(book.area)} · {book.license} · {book.language}
      </p>
      <h3 className="mt-2 text-2xl font-semibold">
        <Link href={`/acervo/${book.id}`} className="hover:text-oxblood">
          {book.title}
        </Link>
      </h3>
      <p className="italic text-ink-soft">
        {book.author}
        {book.year && `, ${book.year}`}
      </p>
      <p className="mt-3 line-clamp-3 flex-1">{book.synopsis}</p>
      <a
        href={book.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 font-sans text-sm underline hover:text-oxblood"
      >
        Ler em {book.source} ↗
      </a>
    </article>
  );
}
