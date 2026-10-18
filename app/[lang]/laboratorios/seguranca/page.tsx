// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { LabSeguranca } from "@/components/labs/Seguranca";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/laboratorios/seguranca">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/laboratorios/seguranca", t.labs.seguranca, t.labs.segurancaLead);
}

export default async function Page({ params }: PageProps<"/[lang]/laboratorios/seguranca">) {
  const { t } = await loadLang(params);
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <PageHeading eyebrow={t.labs.title} title={t.labs.seguranca}>
        {t.labs.segurancaLead}
      </PageHeading>
      <LabSeguranca />
    </div>
  );
}
