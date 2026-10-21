// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { LaboratorioDeDesign } from "@/components/labs/LaboratorioDeDesign";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/laboratorios/design">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/laboratorios/design", t.labs.design, t.labs.designLead);
}

/** O estúdio de design do instituto, aberto para estudantes: cartaz, post, convite e capa, sem conta e sem servidor. */
export default async function Page({ params }: PageProps<"/[lang]/laboratorios/design">) {
  const { t } = await loadLang(params);
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <PageHeading eyebrow={t.labs.title} title={t.labs.design}>
        {t.labs.designIntro}
      </PageHeading>
      <div className="mt-8">
        <LaboratorioDeDesign />
      </div>
    </div>
  );
}
