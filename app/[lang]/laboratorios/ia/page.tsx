// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { LabIA } from "@/components/labs/IA";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";
import { SobreOLaboratorio } from "@/components/labs/MapaDosLaboratorios";

export async function generateMetadata({ params }: PageProps<"/[lang]/laboratorios/ia">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/laboratorios/ia", t.labs.ia, t.labs.iaLead);
}

export default async function Page({ params }: PageProps<"/[lang]/laboratorios/ia">) {
  const { lang, t } = await loadLang(params);
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <PageHeading eyebrow={t.labs.title} title={t.labs.ia}>
        {t.labs.iaLead}
      </PageHeading>
      <SobreOLaboratorio id="ia" t={t} lang={lang} />
      <LabIA />
    </div>
  );
}
