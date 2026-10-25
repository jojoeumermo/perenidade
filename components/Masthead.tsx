// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import Link from "@/components/Link";
import { localePath, type Locale } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import { site } from "@/lib/site";

/** A estrela do símbolo do instituto, recortada para caber sozinha num quadrado. */
export function Star({ className }: { className?: string }) {
  return (
    <svg viewBox="33 9 54 53" aria-hidden className={className}>
      <polygon
        points="60,10 66.29,29.35 86.63,29.35 70.17,41.31 76.46,60.65 60,48.7 43.54,60.65 49.83,41.31 33.37,29.35 53.71,29.35"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * Cabeçalho do jornal, no desenho dos cartazes da imprensa operária: a palavra de ordem no alto,
 * a faixa vermelha com o nome em letra pesada, a cunha preta com a estrela e o fio duplo do expediente.
 */
export function Masthead({ lang, s, slogan, updated, small = false }: { lang: Locale; s: Dict["journal"]; slogan?: string; updated?: string; small?: boolean }) {
  const host = site.url.replace(/^https?:\/\//, "");
  return (
    <header className="jornal-topo">
      {slogan && !small && (
        <p className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pb-1.5 font-mono text-[0.68rem] uppercase tracking-[0.2em] text-ink-soft">
          <span>{slogan}</span>
          {updated && <span>{updated}</span>}
        </p>
      )}
      <Link href={localePath(lang, "/jornal")} className={`jornal-faixa jornal-cartaz ${small ? "jornal-cartaz-menor" : ""}`}>
        <span className="jornal-cartaz-nome font-sans font-black uppercase italic">
          <span className="jornal-cartaz-alto">{s.nameTop}</span> <span className="jornal-cartaz-baixo">{s.nameBottom}</span>
        </span>
        <span className="jornal-cunha" aria-hidden>
          <Star className="jornal-cunha-estrela" />
        </span>
      </Link>
      <p className="jornal-fio flex flex-wrap items-center gap-x-3 gap-y-1 px-1 py-1.5 font-sans text-[0.7rem] font-semibold uppercase tracking-wide">
        <span>{s.tagline}</span>
        <span aria-hidden className="text-oxblood">★</span>
        <span className="normal-case">{host}</span>
        {updated && (small || !slogan) && (
          <>
            <span aria-hidden className="text-oxblood">★</span>
            <span>{updated}</span>
          </>
        )}
        <span aria-hidden className="text-oxblood">★</span>
        <span>{s.free}</span>
      </p>
    </header>
  );
}
