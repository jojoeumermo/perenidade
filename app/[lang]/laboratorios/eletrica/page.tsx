// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { LabEletrica } from "@/components/labs/eletrica/LabEletrica";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";
import { SobreOLaboratorio } from "@/components/labs/MapaDosLaboratorios";

export async function generateMetadata({ params }: PageProps<"/[lang]/laboratorios/eletrica">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/laboratorios/eletrica", t.labs.eletrica, t.labs.eletricaLead);
}

export default async function Page({ params }: PageProps<"/[lang]/laboratorios/eletrica">) {
  const { lang, t } = await loadLang(params);
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <PageHeading eyebrow={t.labs.title} title={t.labs.eletrica}>
        {t.labs.eletricaLead}
      </PageHeading>
      <SobreOLaboratorio id="eletrica" t={t} lang={lang} />
      <div lang="pt-BR">
        <LabEletrica />
      </div>
    </div>
  );
}
