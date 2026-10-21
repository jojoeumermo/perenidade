// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { ContentPageView } from "@/components/ContentPageView";
import { loadLang } from "@/i18n";
import { getPage } from "@/lib/content";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/conduta">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const page = getPage("conduta", lang);
  return paginaMeta(lang, "/conduta", page.title, page.lead);
}

export default async function Conduta({ params }: PageProps<"/[lang]/conduta">) {
  const { lang, t } = await loadLang(params);
  return <ContentPageView slug="conduta" lang={lang} t={t} indice />;
}
