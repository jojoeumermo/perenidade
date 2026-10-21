// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { ContentPageView } from "@/components/ContentPageView";
import { GuiaDeDireitos } from "@/components/governanca/Governanca";
import { loadLang } from "@/i18n";
import { getPage } from "@/lib/content";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/direitos">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const page = getPage("direitos", lang);
  return paginaMeta(lang, "/direitos", page.title, page.lead);
}

export default async function Direitos({ params }: PageProps<"/[lang]/direitos">) {
  const { lang, t } = await loadLang(params);
  return (
    <ContentPageView slug="direitos" lang={lang} t={t} indice={false}>
      <GuiaDeDireitos />
    </ContentPageView>
  );
}
