// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { ContentPageView } from "@/components/ContentPageView";
import { loadLang } from "@/i18n";
import { getPage } from "@/lib/content";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/direitos-autorais">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const page = getPage("direitos-autorais", lang);
  return paginaMeta(lang, "/direitos-autorais", page.title, page.lead);
}

export default async function DireitosAutorais({ params }: PageProps<"/[lang]/direitos-autorais">) {
  const { lang, t } = await loadLang(params);
  return <ContentPageView slug="direitos-autorais" lang={lang} t={t} indice />;
}
