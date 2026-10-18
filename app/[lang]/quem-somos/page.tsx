// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { ContentPageView } from "@/components/ContentPageView";
import { ListaDeEducadores } from "@/components/Educadores";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";
import { getPage } from "@/lib/content";

export async function generateMetadata({ params }: PageProps<"/[lang]/quem-somos">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const page = getPage("quem-somos", lang);
  return paginaMeta(lang, "/quem-somos", page.title, page.lead);
}

export default async function Page({ params }: PageProps<"/[lang]/quem-somos">) {
  const { lang, t } = await loadLang(params);
  return (
    <ContentPageView slug="quem-somos" lang={lang} t={t}>
      <ListaDeEducadores lang={lang} nomes={t.areas as Record<string, string[]>} />
    </ContentPageView>
  );
}
