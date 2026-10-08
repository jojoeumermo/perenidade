// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { licenseName } from "@/components/Cards";
import { originalLang, Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { defaultLocale, fill, localePath } from "@/i18n/config";
import { getAuthors, getBook, getBooks } from "@/lib/content";
import { withLangs } from "@/lib/params";

export const dynamicParams = false;

export function generateStaticParams() {
  return withLangs(getBooks(defaultLocale).map((book) => ({ id: book.id })));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/acervo/[id]">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const book = getBook((await params).id, lang);
  return book ? { title: `${book.title} · ${book.author}`, description: book.synopsis.slice(0, 160) } : {};
}

export default async function BookPage({ params }: PageProps<"/[lang]/acervo/[id]">) {
  const { lang, t } = await loadLang(params);
  const book = getBook((await params).id, lang);
  if (!book) notFound();

  const to = (path: string) => localePath(lang, path);
  const authors = getAuthors(lang).filter((author) => book.authorSlugs.includes(author.slug));
  const label = "font-mono text-xs uppercase tracking-widest text-gold";
  const reserved = book.license === "Direitos reservados";

  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <Link href={to("/acervo")} className="font-sans text-sm text-ink-soft hover:text-oxblood">← {t.library.back}</Link>
      <p className="mt-6 font-mono text-xs uppercase tracking-[0.3em] text-gold">
        <Link href={to(`/estantes/${book.area}`)} className="hover:text-oxblood">{t.areas[book.area][0]}</Link>
      </p>
      <h1 className="mt-2 text-4xl font-semibold sm:text-5xl">{book.title}</h1>
      <p className="mt-2 text-2xl italic text-ink-soft">
        {book.author}
        {book.year && `, ${book.year}`}
      </p>
      <Untranslated lang={lang} t={t} show={!book.translated} />
      <p className="mt-8 text-xl leading-relaxed" {...originalLang(book.translated)}>{book.synopsis}</p>

      <a
        href={book.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-8 inline-block bg-ink px-8 py-3 font-sans text-sm font-medium text-parchment hover:bg-oxblood"
      >
        {fill(reserved ? t.library.seeAt : t.common.readAt, { source: book.source })} ↗
      </a>

      <dl className="mt-10 grid gap-x-8 gap-y-4 border-t border-rule pt-6 font-sans text-sm sm:grid-cols-[8rem_1fr]">
        {authors.length > 0 && (
          <>
            <dt className={label}>{t.nav.authors}</dt>
            <dd>
              {authors.map((author, i) => (
                <span key={author.slug}>
                  {i > 0 && ", "}
                  <Link href={to(`/autores#${author.slug}`)} className="underline hover:text-oxblood">{author.name}</Link>
                </span>
              ))}
            </dd>
          </>
        )}
        <dt className={label}>{t.library.language}</dt>
        <dd>{book.language}</dd>
        <dt className={label}>{t.library.source}</dt>
        <dd>{book.source}</dd>
        <dt className={label}>{t.library.license}</dt>
        <dd>
          <strong>{licenseName(t, book.license)}.</strong> {(t.library.licenseNotes as Record<string, string>)[book.license]}{" "}
          {!reserved && t.library.varies}
        </dd>
      </dl>

      <p className="mt-8 flex flex-wrap gap-x-6 gap-y-2 font-sans text-sm text-ink-soft">
        <Link href={`${to("/contribuir")}?corrigir=${encodeURIComponent(`/acervo/${book.id}`)}`} className="underline hover:text-oxblood">{t.library.fix}</Link>
        <Link href={to(`/denunciar?item=${encodeURIComponent(`/acervo/${book.id}`)}`)} className="underline hover:text-oxblood">
          {t.common.report}
        </Link>
      </p>
    </article>
  );
}
