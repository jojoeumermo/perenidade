// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
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
    <section className={`mx-auto max-w-4xl px-4 py-10 text-center ${hydrated ? "" : "invisible"}`} lang="pt-BR">
      <blockquote className="text-3xl italic leading-snug">“{quote.texto}”</blockquote>
      <p className="mt-4 font-mono text-xs uppercase tracking-widest text-gold">
        {quote.autor} · {quote.fonte}
      </p>
    </section>
  );
}
