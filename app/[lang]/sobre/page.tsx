// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { ContentPageView } from "@/components/ContentPageView";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";
import { getPage } from "@/lib/content";

export async function generateMetadata({ params }: PageProps<"/[lang]/sobre">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const page = getPage("sobre", lang);
  return paginaMeta(lang, "/sobre", page.title, page.lead);
}

export default async function Page({ params }: PageProps<"/[lang]/sobre">) {
  const { lang, t } = await loadLang(params);
  return <ContentPageView slug="sobre" lang={lang} t={t} />;
}
