// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { LabQuimica } from "@/components/labs/quimica/LabQuimica";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/laboratorios/quimica">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/laboratorios/quimica", t.labs.quimica, t.labs.quimicaLead);
}

export default async function Page({ params }: PageProps<"/[lang]/laboratorios/quimica">) {
  const { t } = await loadLang(params);
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <PageHeading eyebrow={t.labs.title} title={t.labs.quimica}>
        {t.labs.quimicaLead}
      </PageHeading>
      <div lang="pt-BR">
        <LabQuimica />
      </div>
    </div>
  );
}
