// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { TerminalLinux } from "@/components/labs/TerminalLinux";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/laboratorios/linux">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/laboratorios/linux", t.labs.linux, t.labs.linuxLead);
}

export default async function Page({ params }: PageProps<"/[lang]/laboratorios/linux">) {
  const { t } = await loadLang(params);
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <PageHeading eyebrow={t.labs.title} title={t.labs.linux}>
        {t.labs.linuxLead}
      </PageHeading>
      <TerminalLinux />
    </div>
  );
}
