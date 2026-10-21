// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { ContentPageView } from "@/components/ContentPageView";
import { loadLang } from "@/i18n";
import { getPage } from "@/lib/content";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/uso">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const page = getPage("uso", lang);
  return paginaMeta(lang, "/uso", page.title, page.lead);
}

export default async function Uso({ params }: PageProps<"/[lang]/uso">) {
  const { lang, t } = await loadLang(params);
  return <ContentPageView slug="uso" lang={lang} t={t} indice />;
}
