// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useSyncExternalStore } from "react";
import type { Quote } from "@/lib/content";

// O dia de hoje no fuso de quem lê. No servidor não há "hoje": a data seria a do build.
const today = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
const never = () => () => {};

/** Uma frase por dia, escolhida pela data: todo mundo vê a mesma, e amanhã é outra. */
export function DailyQuote({ quotes }: { quotes: Quote[] }) {
  const day = useSyncExternalStore(never, today, () => -1);
  if (quotes.length === 0) return null;
  const hydrated = day >= 0;
  const quote = quotes[Math.max(day, 0) % quotes.length];
  return (
    <section className={`mx-auto max-w-4xl px-4 py-14 text-center ${hydrated ? "" : "invisible"}`} lang="pt-BR">
      <p aria-hidden className="text-lg tracking-[0.5em] text-prelo-texto">★ ★ ★</p>
      <blockquote className="mt-4 text-3xl italic leading-snug text-balance sm:text-4xl">“{quote.texto}”</blockquote>
      <p className="rotulo mt-5">
        {quote.autor} · {quote.fonte}
      </p>
    </section>
  );
}
