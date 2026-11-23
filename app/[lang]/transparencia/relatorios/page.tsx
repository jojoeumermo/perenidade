// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { ContentPageView } from "@/components/ContentPageView";
import { ListaDeRelatorios } from "@/components/transparencia/Paineis";
import { loadLang } from "@/i18n";
import { getPage } from "@/lib/content";
import { paginaMeta } from "@/lib/seo";
import { relatoriosDeAuditoria } from "@/lib/transparencia";

export async function generateMetadata({ params }: PageProps<"/[lang]/transparencia/relatorios">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const page = getPage("transparencia-relatorios", lang);
  return paginaMeta(lang, "/transparencia/relatorios", page.title, page.lead);
}

/** Os relatórios de auditoria externa, na íntegra (content/transparencia/relatorios.json). */
export default async function Page({ params }: PageProps<"/[lang]/transparencia/relatorios">) {
  const { lang, t } = await loadLang(params);
  return (
    <ContentPageView slug="transparencia-relatorios" lang={lang} t={t}>
      <ListaDeRelatorios lang={lang} relatorios={relatoriosDeAuditoria()} />
    </ContentPageView>
  );
}
