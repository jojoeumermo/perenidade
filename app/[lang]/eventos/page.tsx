// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { ContentPageView } from "@/components/ContentPageView";
import { Agenda, type Encontro } from "@/components/governanca/Agenda";
import eventos from "@/content/eventos.json";
import { loadLang } from "@/i18n";
import { getPage } from "@/lib/content";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/eventos">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const page = getPage("eventos", lang);
  return paginaMeta(lang, "/eventos", page.title, page.lead);
}

export default async function Eventos({ params }: PageProps<"/[lang]/eventos">) {
  const { lang, t } = await loadLang(params);
  return (
    <ContentPageView slug="eventos" lang={lang} t={t} indice={false}>
      <Agenda eventos={eventos.eventos as Encontro[]} />
    </ContentPageView>
  );
}
