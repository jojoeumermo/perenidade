import type { Metadata } from "next";
import { ContentPageView } from "@/components/ContentPageView";
import { loadLang } from "@/i18n";
import { getPage } from "@/lib/content";

export async function generateMetadata({ params }: PageProps<"/[lang]/glossario">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const page = getPage("glossario", lang);
  return { title: page.title, description: page.lead };
}

export default async function Page({ params }: PageProps<"/[lang]/glossario">) {
  const { lang, t } = await loadLang(params);
  return <ContentPageView slug="glossario" lang={lang} t={t} />;
}
