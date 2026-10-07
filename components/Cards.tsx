import Link from "next/link";
import { fill, localePath, plural, type Locale } from "@/i18n/config";
import type { Dict } from "@/i18n/pt";
import type { Book, Track } from "@/lib/content";
import { lessonId } from "@/lib/ids";
import { TrackProgress } from "./Progress";
import { originalLang } from "./Untranslated";

interface Props {
  lang: Locale;
  t: Dict;
}

export const licenseName = (t: Dict, license: string) => t.library.licenseNames[license] ?? license;

export function TrackCard({ track, lang, t }: Props & { track: Track }) {
  return (
    <article className="flex flex-col border border-rule bg-parchment-deep p-6">
      <p className="font-mono text-xs text-gold">
        {t.areas[track.area][0]} · {t.levels[track.level]} · {plural(lang, track.lessons.length, t.common.lessons)}
      </p>
      <h3 className="mt-2 text-2xl font-semibold" {...originalLang(track.translated)}>
        <Link href={localePath(lang, `/trilhas/${track.slug}`)} className="hover:text-oxblood">
          {track.title}
        </Link>
      </h3>
      <p className="mt-1 flex-1 text-ink-soft" {...originalLang(track.translated)}>{track.summary}</p>
      <div className="mt-5">
        <TrackProgress ids={track.lessons.map((l) => lessonId(track.slug, l.slug))} />
      </div>
    </article>
  );
}

export function BookCard({ book, lang, t }: Props & { book: Book }) {
  return (
    <article className="flex flex-col border border-rule bg-parchment-deep p-6">
      <p className="font-mono text-xs text-gold">
        {t.areas[book.area][0]} · {licenseName(t, book.license)} · {book.language}
      </p>
      <h3 className="mt-2 text-2xl font-semibold">
        <Link href={localePath(lang, `/acervo/${book.id}`)} className="hover:text-oxblood">
          {book.title}
        </Link>
      </h3>
      <p className="italic text-ink-soft">
        {book.author}
        {book.year && `, ${book.year}`}
      </p>
      <p className="mt-3 line-clamp-3 flex-1" {...originalLang(book.translated)}>{book.synopsis}</p>
      <a href={book.url} target="_blank" rel="noopener noreferrer" className="mt-4 font-sans text-sm underline hover:text-oxblood">
        {fill(t.common.readAt, { source: book.source })} ↗
      </a>
    </article>
  );
}
