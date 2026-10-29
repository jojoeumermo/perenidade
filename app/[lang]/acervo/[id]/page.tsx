// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "@/components/Link";
import { DadosEstruturados } from "@/components/DadosEstruturados";
import { livro, migalhas } from "@/lib/dados-estruturados";
import { notFound } from "next/navigation";
import { CapaDoLivro as Capa } from "@/components/acervo/CapaDoLivro";
import { licenseName } from "@/components/Cards";
import { originalLang, Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";
import { defaultLocale, fill, localePath } from "@/i18n/config";
import { getAuthors, getBook, getBooks, idiomasDe } from "@/lib/content";
import { nosIdiomasDoTexto } from "@/lib/params";

// O build monta cada obra só nos idiomas em que o texto dela existe; as outras versões saem na primeira visita (veja
// lib/params.ts). Obra que não existe continua dando 404 (notFound abaixo).
export const dynamicParams = true;

export function generateStaticParams() {
  return nosIdiomasDoTexto(getBooks(defaultLocale).map((book) => ({ params: { id: book.id }, file: book.file })));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/acervo/[id]">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  const book = getBook((await params).id, lang);
  return book ? paginaMeta(lang, `/acervo/${book.id}`, `${book.title} · ${book.author}`, book.synopsis.slice(0, 160), { titulo: book.title, subtitulo: book.author, kicker: t.nav.library }, { idiomas: idiomasDe(book.file) }) : {};
}

export default async function BookPage({ params }: PageProps<"/[lang]/acervo/[id]">) {
  const { lang, t } = await loadLang(params);
  const book = getBook((await params).id, lang);
  if (!book) notFound();

  const to = (path: string) => localePath(lang, path);
  const authors = getAuthors(lang).filter((author) => book.authorSlugs.includes(author.slug));
  const label = "font-mono text-xs uppercase tracking-widest text-gold";
  const reserved = book.license === "Direitos reservados";

  // No aplicativo a ficha abre como a folha de rosto de um livro: título e autor no centro, a sinopse como texto de
  // leitura e o botão de ler preso ao alcance do polegar. A seta de voltar já está na barra de cima.
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 app:max-md:px-5">
      <DadosEstruturados dados={[livro(lang, book), migalhas(lang, [[t.nav.library, "/acervo"], [t.areas[book.area][0], `/estantes/${book.area}`], [book.title, `/acervo/${book.id}`]])]} />
      <Link href={to("/acervo")} className="voltar-da-pagina font-sans text-sm text-ink-soft hover:text-oxblood app:max-md:hidden">← {t.library.back}</Link>
      {/* A capa ao lado do título: a da edição (fonte aberta, guardada no site) ou a desenhada da coleção. */}
      <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-end app:max-md:mt-2 app:max-md:items-center">
        <figure className="shrink-0 self-center sm:self-auto">
          <Capa book={book} grande />
          {book.coverCredit && <figcaption className="mt-2 max-w-48 font-sans text-[0.65rem] text-ink-soft">Capa: {book.coverCredit}</figcaption>}
        </figure>
        <div className="min-w-0">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold app:max-md:text-center">
            <Link href={to(`/estantes/${book.area}`)} className="hover:text-oxblood">{t.areas[book.area][0]}</Link>
          </p>
          <h1 className="mt-2 text-4xl font-semibold app:max-md:mt-4 app:max-md:text-center app:max-md:text-[2.125rem] app:max-md:leading-[1.12] sm:text-5xl">{book.title}</h1>
          <p className="mt-2 text-2xl italic text-ink-soft app:max-md:mt-3 app:max-md:text-center app:max-md:text-xl app:max-md:after:mx-auto app:max-md:after:mt-5 app:max-md:after:block app:max-md:after:h-px app:max-md:after:w-16 app:max-md:after:bg-gold">
            {book.author}
            {book.year && `, ${book.year}`}
          </p>
        </div>
      </div>
      <Untranslated lang={lang} t={t} show={!book.translated} />
      <p className="mt-8 text-xl leading-relaxed app:max-md:mt-6 app:max-md:text-[1.1875rem] app:max-md:leading-[1.75] app:max-md:hyphens-auto" {...originalLang(book.translated)}>{book.synopsis}</p>

      <a
        href={book.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-8 inline-block bg-ink px-8 py-3 font-sans text-sm font-medium text-parchment hover:bg-oxblood app:max-md:sticky app:max-md:bottom-[calc(4.25rem+var(--recuo-baixo))] app:max-md:z-10 app:max-md:block app:max-md:py-4 app:max-md:text-center app:max-md:text-base"
      >
        {fill(reserved ? t.library.seeAt : t.common.readAt, { source: book.source })} ↗
      </a>
      {/* Livros da biblioteca digital do MEC: quem lê precisa da conta gov.br, e é bom saber disso antes de clicar. */}
      {book.source === "MEC Livros" && <p className="mt-3 max-w-xl font-sans text-sm text-ink-soft">{t.library.mecNote}</p>}

      <dl className="mt-10 grid gap-x-8 gap-y-4 border-t border-rule pt-6 font-sans text-sm app:max-md:gap-y-1.5 app:max-md:rounded-[0.875rem] app:max-md:border app:max-md:bg-parchment-deep app:max-md:p-4 app:max-md:[&>dd]:mb-3 app:max-md:[&>dd:last-child]:mb-0 sm:grid-cols-[8rem_1fr]">
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
        <Link href={`${to("/comunidade")}?nova=1&alvo=${encodeURIComponent(`/acervo/${book.id}`)}&titulo=${encodeURIComponent(book.title)}&sala=${book.area}`} className="underline hover:text-oxblood">{t.common.askCommunity}</Link>
        <Link href={to(`/denunciar?item=${encodeURIComponent(`/acervo/${book.id}`)}`)} className="underline hover:text-oxblood">
          {t.common.report}
        </Link>
      </p>
    </article>
  );
}
