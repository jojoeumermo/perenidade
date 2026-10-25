// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "@/components/Link";
import { ListaComIndice } from "@/components/ListaComIndice";
import { PageHeading } from "@/components/PageHeading";
import { originalLang, Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";
import { fill, localePath } from "@/i18n/config";
import { getAuthors, getBooks } from "@/lib/content";

export async function generateMetadata({ params }: PageProps<"/[lang]/autores">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/autores", t.authors.title, t.authors.lead);
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

      <ListaComIndice
        az
        rotulo={t.authors.title}
        items={authors.map((author) => {
          const works = books.filter((book) => book.authorSlugs.includes(author.slug));
          return {
            id: author.slug,
            nome: author.name,
            chaves: `${author.name} ${author.place} ${author.years} ${author.bio}`,
            meta: String(works.length),
            node: (
            <article className="border border-rule bg-parchment-deep p-6">
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
            ),
          };
        })}
      />
    </div>
  );
}
