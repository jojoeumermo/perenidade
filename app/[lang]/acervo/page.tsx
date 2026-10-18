// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { Suspense } from "react";
import { AcervoBrowser } from "@/components/AcervoBrowser";
import { Cartaz } from "@/components/Cartaz";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";
import { getBooks } from "@/lib/content";
import { fileHistory } from "@/lib/history";

// Obras do mesmo dia (acrescentadas em lote) saem numa ordem fixa, mas não alfabética: uma estante de Novidades com oito "A…" seguidos não diz nada.
const misturar = (id: string) => [...id].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);

export async function generateMetadata({ params }: PageProps<"/[lang]/acervo">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/acervo", t.library.title, t.library.description);
}

export default async function Acervo({ params }: PageProps<"/[lang]/acervo">) {
  const { lang, t } = await loadLang(params);
  const books = getBooks(lang);
  // Novidades: as oito obras acrescentadas por último, pela data do histórico (índice de uma passada só).
  const novidades = books
    .map((b) => ({ id: b.id, data: fileHistory(b.file).updated ?? "" }))
    .filter((x) => x.data)
    .sort((a, b) => b.data.localeCompare(a.data) || misturar(a.id) - misturar(b.id))
    .slice(0, 8)
    .map((x) => x.id);
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <Cartaz eyebrow={t.library.eyebrow} title={t.library.title} slogan={t.slogans.acervo} tone="preto">
        {t.library.lead}
      </Cartaz>
      <Suspense>
        <AcervoBrowser books={books} novidades={novidades} />
      </Suspense>
    </div>
  );
}
