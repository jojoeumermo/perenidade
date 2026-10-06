import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { areaName } from "@/lib/areas";
import { getBook, getBooks } from "@/lib/content";
import { github } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return getBooks().map((book) => ({ id: book.id }));
}

export async function generateMetadata({ params }: PageProps<"/acervo/[id]">): Promise<Metadata> {
  const book = getBook((await params).id);
  return book ? { title: `${book.title}, de ${book.author}`, description: book.synopsis.slice(0, 160) } : {};
}

const licenseNotes: Record<string, string> = {
  "Domínio público": "Os direitos patrimoniais expiraram. A obra pode ser lida, copiada e redistribuída livremente.",
  "CC BY": "Pode ser copiada e adaptada, inclusive para fins comerciais, desde que se dê crédito ao autor.",
  "CC BY-SA": "Pode ser copiada e adaptada com crédito ao autor; obras derivadas devem manter a mesma licença.",
  "CC BY-NC": "Pode ser copiada e adaptada com crédito ao autor, apenas para fins não comerciais.",
  "CC BY-NC-SA": "Uso não comercial, com crédito ao autor; obras derivadas devem manter a mesma licença.",
  "CC BY-NC-ND": "Pode ser redistribuída sem alterações, com crédito ao autor, apenas para fins não comerciais.",
};

export default async function BookPage({ params }: PageProps<"/acervo/[id]">) {
  const book = getBook((await params).id);
  if (!book) notFound();

  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <Link href="/acervo" className="font-sans text-sm text-ink-soft hover:text-oxblood">← Acervo</Link>
      <p className="mt-6 font-mono text-xs uppercase tracking-[0.3em] text-gold">
        <Link href={`/estantes/${book.area}`} className="hover:text-oxblood">{areaName(book.area)}</Link>
      </p>
      <h1 className="mt-2 text-4xl font-semibold sm:text-5xl">{book.title}</h1>
      <p className="mt-2 text-2xl italic text-ink-soft">
        {book.author}
        {book.year && `, ${book.year}`}
      </p>
      <p className="mt-8 text-xl leading-relaxed">{book.synopsis}</p>

      <a
        href={book.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-8 inline-block bg-ink px-8 py-3 font-sans text-sm font-medium text-parchment hover:bg-oxblood"
      >
        Ler em {book.source} ↗
      </a>

      <dl className="mt-10 grid gap-x-8 gap-y-4 border-t border-rule pt-6 font-sans text-sm sm:grid-cols-[8rem_1fr]">
        <dt className="font-mono text-xs uppercase tracking-widest text-gold">Idioma</dt>
        <dd>{book.language}</dd>
        <dt className="font-mono text-xs uppercase tracking-widest text-gold">Fonte</dt>
        <dd>{book.source}</dd>
        <dt className="font-mono text-xs uppercase tracking-widest text-gold">Licença</dt>
        <dd>
          <strong>{book.license}.</strong> {licenseNotes[book.license]} A situação legal pode variar conforme o país; confira
          os termos na página da fonte.
        </dd>
      </dl>

      <p className="mt-8 flex flex-wrap gap-x-6 gap-y-2 font-sans text-sm text-ink-soft">
        <a href={github.edit(book.file)} target="_blank" rel="noopener noreferrer" className="underline hover:text-oxblood">
          Corrigir esta ficha
        </a>
        <a href={github.history(book.file)} target="_blank" rel="noopener noreferrer" className="underline hover:text-oxblood">
          Histórico de versões
        </a>
        <Link href={`/denunciar?item=${encodeURIComponent(`/acervo/${book.id}`)}`} className="underline hover:text-oxblood">
          Denunciar
        </Link>
      </p>
    </article>
  );
}
