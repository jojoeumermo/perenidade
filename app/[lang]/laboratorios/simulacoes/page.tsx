// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { PhetLista } from "@/components/labs/Phet";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/laboratorios/simulacoes">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/laboratorios/simulacoes", t.labs.simulacoes, t.labs.simulacoesLead);
}

export default async function Page({ params }: PageProps<"/[lang]/laboratorios/simulacoes">) {
  const { t } = await loadLang(params);
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <PageHeading eyebrow={t.labs.title} title={t.labs.simulacoes}>
        {t.labs.simulacoesLead}
      </PageHeading>
      <PhetLista />
    </div>
  );
}
