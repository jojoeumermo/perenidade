// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { ContentPageView } from "@/components/ContentPageView";
import { ListaDeContribuidores } from "@/components/governanca/Governanca";
import { loadLang } from "@/i18n";
import { getPage } from "@/lib/content";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/contribuidores">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const page = getPage("contribuidores", lang);
  return paginaMeta(lang, "/contribuidores", page.title, page.lead);
}

export default async function Contribuidores({ params }: PageProps<"/[lang]/contribuidores">) {
  const { lang, t } = await loadLang(params);
  return (
    <ContentPageView slug="contribuidores" lang={lang} t={t} indice={false}>
      <ListaDeContribuidores />
    </ContentPageView>
  );
}
