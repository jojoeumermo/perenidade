// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { L, useI18n } from "@/components/I18n";

export default function NotFound() {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-3xl px-4 py-24 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">{t.notFound.eyebrow}</p>
      <h1 className="mt-3 text-5xl font-semibold">{t.notFound.title}</h1>
      <p className="mx-auto mt-4 max-w-xl text-xl text-ink-soft">{t.notFound.text}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-4 font-sans text-sm">
        <L href="/busca" className="bg-ink px-8 py-3 font-medium text-parchment hover:bg-oxblood">{t.notFound.search}</L>
        <L href="/" className="border-2 border-ink px-8 py-3 font-medium hover:border-oxblood hover:text-oxblood">{t.notFound.home}</L>
      </div>
      <p className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 font-sans text-sm">
        <L href="/trilhas" className="underline hover:text-oxblood">{t.nav.disciplines}</L>
        <L href="/acervo" className="underline hover:text-oxblood">{t.nav.library}</L>
        <L href="/comecar" className="underline hover:text-oxblood">{t.nav.start}</L>
      </p>
    </div>
  );
}
