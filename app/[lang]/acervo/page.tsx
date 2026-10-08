// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
import type { Metadata } from "next";
import { Suspense } from "react";
import { AcervoBrowser } from "@/components/AcervoBrowser";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { getBooks } from "@/lib/content";

export async function generateMetadata({ params }: PageProps<"/[lang]/acervo">): Promise<Metadata> {
  const { t } = await loadLang(params);
  return { title: t.library.title, description: t.library.description };
}

export default async function Acervo({ params }: PageProps<"/[lang]/acervo">) {
  const { lang, t } = await loadLang(params);
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <PageHeading eyebrow={t.library.eyebrow} title={t.library.title}>
        {t.library.lead}
      </PageHeading>
      <Suspense>
        <AcervoBrowser books={getBooks(lang)} />
      </Suspense>
    </div>
  );
}
