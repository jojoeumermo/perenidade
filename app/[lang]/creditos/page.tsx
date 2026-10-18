// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { ContentPageView } from "@/components/ContentPageView";
import { loadLang } from "@/i18n";
import { getPage } from "@/lib/content";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/creditos">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const page = getPage("creditos", lang);
  return paginaMeta(lang, "/creditos", page.title, page.lead);
}

export default async function Page({ params }: PageProps<"/[lang]/creditos">) {
  const { lang, t } = await loadLang(params);
  return <ContentPageView slug="creditos" lang={lang} t={t} />;
}
