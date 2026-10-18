// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { Planilha } from "@/components/labs/Planilha";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/laboratorios/planilha">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/laboratorios/planilha", t.labs.planilha, t.labs.planilhaLead);
}

export default async function Page({ params }: PageProps<"/[lang]/laboratorios/planilha">) {
  const { t } = await loadLang(params);
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <PageHeading eyebrow={t.labs.title} title={t.labs.planilha}>
        {t.labs.planilhaLead}
      </PageHeading>
      <Planilha />
    </div>
  );
}
