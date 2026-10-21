// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { ContentPageView } from "@/components/ContentPageView";
import { TarefasDeVoluntariado } from "@/components/governanca/Governanca";
import { loadLang } from "@/i18n";
import { getPage } from "@/lib/content";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/voluntarie-se">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const page = getPage("voluntarie-se", lang);
  return paginaMeta(lang, "/voluntarie-se", page.title, page.lead);
}

export default async function VoluntarieSe({ params }: PageProps<"/[lang]/voluntarie-se">) {
  const { lang, t } = await loadLang(params);
  return (
    <ContentPageView slug="voluntarie-se" lang={lang} t={t} tone="vermelho" indice={false}>
      <TarefasDeVoluntariado />
    </ContentPageView>
  );
}
