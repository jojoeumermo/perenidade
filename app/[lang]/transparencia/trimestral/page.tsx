// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { ContentPageView } from "@/components/ContentPageView";
import { Trimestrais } from "@/components/transparencia/Paineis";
import { loadLang } from "@/i18n";
import { getPage } from "@/lib/content";
import { paginaMeta } from "@/lib/seo";
import { relatoriosTrimestrais } from "@/lib/transparencia";

export async function generateMetadata({ params }: PageProps<"/[lang]/transparencia/trimestral">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const page = getPage("transparencia-trimestral", lang);
  return paginaMeta(lang, "/transparencia/trimestral", page.title, page.lead);
}

/** Os relatórios trimestrais de segurança e de pedidos (content/transparencia/trimestral/AAAA-TN.md). */
export default async function Page({ params }: PageProps<"/[lang]/transparencia/trimestral">) {
  const { lang, t } = await loadLang(params);
  return (
    <ContentPageView slug="transparencia-trimestral" lang={lang} t={t}>
      <Trimestrais lang={lang} relatorios={relatoriosTrimestrais()} />
    </ContentPageView>
  );
}
