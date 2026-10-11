// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import Link from "next/link";
import { localePath, type Locale } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import { site } from "@/lib/site";

/** Cabeçalho do jornal, no desenho da imprensa operária: faixa vermelha, título pesado, linha de expediente. */
export function Masthead({ lang, s, updated, small = false }: { lang: Locale; s: Dict["journal"]; updated?: string; small?: boolean }) {
  const host = site.url.replace(/^https?:\/\//, "");
  return (
    <header className="jornal-topo">
      <Link href={localePath(lang, "/jornal")} className={`jornal-faixa block ${small ? "px-4 py-3" : "px-4 py-5 sm:px-6 sm:py-7"}`}>
        <span className={`jornal-nome block font-sans font-black uppercase italic ${small ? "jornal-nome-menor" : ""}`}>
          {s.nameTop} {s.nameBottom}
        </span>
      </Link>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b-4 border-ink px-1 py-1.5 font-sans text-[0.7rem] font-semibold uppercase tracking-wide">
        <span>{s.tagline}</span>
        <span aria-hidden>·</span>
        <span className="normal-case">{host}</span>
        {updated && (
          <>
            <span aria-hidden>·</span>
            <span>{updated}</span>
          </>
        )}
        <span aria-hidden>·</span>
        <span>{s.free}</span>
        <span aria-hidden>·</span>
        <Link href={localePath(lang, "/noticias")} className="underline hover:text-oxblood">{s.round}</Link>
      </p>
    </header>
  );
}
