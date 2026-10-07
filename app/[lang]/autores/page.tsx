import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/PageHeading";
import { originalLang, Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { fill, localePath } from "@/i18n/config";
import { getAuthors, getBooks } from "@/lib/content";

export async function generateMetadata({ params }: PageProps<"/[lang]/autores">): Promise<Metadata> {
  const { t } = await loadLang(params);
  return { title: t.authors.title, description: t.authors.lead };
}

export default async function Autores({ params }: PageProps<"/[lang]/autores">) {
  const { lang, t } = await loadLang(params);
  const authors = getAuthors(lang);
  const books = getBooks(lang);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <PageHeading eyebrow={t.authors.eyebrow} title={t.authors.title}>
        {t.authors.lead}
      </PageHeading>
      <Untranslated lang={lang} t={t} show={authors.some((author) => !author.translated)} />

      <nav aria-label={t.authors.title} className="mt-8 flex flex-wrap gap-x-4 gap-y-1 font-sans text-sm">
        {authors.map((author) => (
          <a key={author.slug} href={`#${author.slug}`} className="underline hover:text-oxblood">{author.name}</a>
        ))}
      </nav>

      <div className="mt-10 space-y-6">
        {authors.map((author) => {
          const works = books.filter((book) => book.authorSlugs.includes(author.slug));
          return (
            <article key={author.slug} id={author.slug} className="scroll-mt-6 border border-rule bg-parchment-deep p-6">
              <p className="font-mono text-xs text-gold">
                {author.years} · {author.place}
              </p>
              <h2 className="mt-2 text-3xl font-semibold">{author.name}</h2>
              <p className="mt-3 text-lg" {...originalLang(author.translated)}>{author.bio}</p>

              <h3 className="mt-5 font-mono text-xs uppercase tracking-widest text-gold">{t.authors.inLibrary}</h3>
              {works.length > 0 ? (
                <ul className="mt-2 space-y-1 font-sans text-sm">
                  {works.map((book) => (
                    <li key={book.id}>
                      <Link href={localePath(lang, `/acervo/${book.id}`)} className="underline hover:text-oxblood">{book.title}</Link>
                      {book.year && <span className="text-ink-soft"> ({book.year})</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 font-sans text-sm text-ink-soft">{t.authors.none}</p>
              )}
              {author.archiveUrl && (
                <a
                  href={author.archiveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-block font-sans text-sm underline hover:text-oxblood"
                >
                  {fill(t.authors.fullArchive, { source: author.archiveSource ?? "" })} ↗
                </a>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
