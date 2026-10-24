// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import Link from "next/link";
import type { ReactNode } from "react";
import { fill } from "@/i18n/config";
import type { CoreDict } from "@/i18n/core";
import type { Book } from "@/lib/content";
import { licenseName } from "../Cards";
import { originalLang } from "../Untranslated";
import { CapaDoLivro } from "./CapaDoLivro";

/**
 * A ficha de uma obra nas listas (acervo, estantes): a capa, o chapéu com a área e a licença, o título em letra de
 * livro, o autor e o começo da sinopse. `acao` é um botão a mais no pé (guardar na estante).
 */
export function CartaoDaObra({ book, t, href, acao, vermelho = false }: { book: Book; t: Pick<CoreDict, "areas" | "library" | "common">; href: string; acao?: ReactNode; vermelho?: boolean }) {
  return (
    <article className={`${vermelho ? "cartao-v" : "cartao"} flex gap-5 p-5 max-sm:gap-4 max-sm:p-4`}>
      <Link href={href} tabIndex={-1} aria-hidden className="shrink-0 self-start">
        <CapaDoLivro book={book} />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="font-mono text-[0.68rem] font-medium uppercase tracking-[0.14em] text-prelo-texto">
          {t.areas[book.area][0]} · {licenseName(t as CoreDict, book.license)}
        </p>
        <h3 className="mt-1.5 font-serif text-[1.35rem] font-semibold leading-[1.15] text-balance">
          <Link href={href} className="text-ink hover:underline hover:decoration-[#c21f16] hover:decoration-2">
            {book.title}
          </Link>
        </h3>
        <p className="mt-0.5 italic text-ink-soft">
          {book.author}
          {book.year && `, ${book.year}`}
        </p>
        <p className="mt-2 line-clamp-3 text-[0.98rem] leading-snug max-sm:line-clamp-2" {...originalLang(book.translated)}>
          {book.synopsis}
        </p>
        <p className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-3 font-sans text-sm font-semibold">
          <a href={book.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline decoration-[#c21f16] decoration-2 underline-offset-4 hover:text-prelo-texto">
            {fill(t.common.readAt, { source: book.source })} ↗
          </a>
          {acao}
        </p>
      </div>
    </article>
  );
}
