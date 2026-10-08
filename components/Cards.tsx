// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
import Link from "next/link";
import { fill, localePath, type Locale } from "@/i18n/config";
import type { Book, Source, Track } from "@/lib/content";
import { lessonId } from "@/lib/ids";
import type { CoreDict } from "@/i18n/core";
import { TrackProgress } from "./Progress";
import { originalLang } from "./Untranslated";

interface Props {
  lang: Locale;
  t: CoreDict;
}

export const licenseName = (t: CoreDict, license: string) => (t.library.licenseNames as Record<string, string>)[license] ?? license;

export function TrackCard({ track, lang, t }: Props & { track: Track }) {
  const ready = track.plan.filter((item) => item.ready).length;
  return (
    <article className="flex flex-col border border-rule bg-parchment-deep p-6">
      <p className="font-mono text-xs text-gold">
        {t.areas[track.area][0]} · {t.stages[track.stage]} · {fill(t.tracks.ready, { a: ready, b: track.plan.length })}
      </p>
      <h3 className="mt-2 text-2xl font-semibold" {...originalLang(track.translated)}>
        <Link href={localePath(lang, `/trilhas/${track.slug}`)} className="hover:text-oxblood">
          {track.title}
        </Link>
      </h3>
      <p className="mt-1 flex-1 text-ink-soft" {...originalLang(track.translated)}>{track.summary}</p>
      {ready > 0 && (
        <div className="mt-5">
          <TrackProgress ids={track.lessons.map((l) => lessonId(track.slug, l.slug))} />
        </div>
      )}
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

/** Lista de fontes de uma aula, matéria ou checagem. */
export function SourceList({ sources, title }: { sources: Source[]; title: string }) {
  if (sources.length === 0) return null;
  return (
    <section className="mt-10 border-t border-rule pt-6 font-sans text-sm">
      <h2 className="font-mono text-xs uppercase tracking-widest text-gold">{title}</h2>
      <ul className="mt-3 space-y-2">
        {sources.map((source) => (
          <li key={`${source.title}${source.url ?? ""}`} className="text-ink-soft">
            {source.author && `${source.author}. `}
            {source.url ? (
              <a href={source.url} target="_blank" rel="noopener noreferrer" className="italic underline hover:text-oxblood">{source.title}</a>
            ) : (
              <span className="italic">{source.title}</span>
            )}
            {source.year && ` (${source.year})`}
            {"."}
          </li>
        ))}
      </ul>
    </section>
  );
}
