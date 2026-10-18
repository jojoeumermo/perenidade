// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { Suspense } from "react";
import { AcervoBrowser } from "@/components/AcervoBrowser";
import { Cartaz } from "@/components/Cartaz";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";
import { getBooks } from "@/lib/content";

export async function generateMetadata({ params }: PageProps<"/[lang]/acervo">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/acervo", t.library.title, t.library.description);
}

export default async function Acervo({ params }: PageProps<"/[lang]/acervo">) {
  const { lang, t } = await loadLang(params);
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <Cartaz eyebrow={t.library.eyebrow} title={t.library.title} slogan={t.slogans.acervo} tone="preto">
        {t.library.lead}
      </Cartaz>
      <Suspense>
        <AcervoBrowser books={getBooks(lang)} />
      </Suspense>
    </div>
  );
}
