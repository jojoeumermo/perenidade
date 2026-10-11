// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeading } from "@/components/PageHeading";
import { SearchClient } from "@/components/SearchClient";
import { loadLang } from "@/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/busca">): Promise<Metadata> {
  const { t } = await loadLang(params);
  return { title: t.search.title, description: t.search.lead };
}

export default async function Busca({ params }: PageProps<"/[lang]/busca">) {
  const { t } = await loadLang(params);
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <PageHeading eyebrow={t.search.eyebrow} title={t.search.title}>
        {t.search.lead}
      </PageHeading>
      <Suspense>
        <SearchClient />
      </Suspense>
    </div>
  );
}
