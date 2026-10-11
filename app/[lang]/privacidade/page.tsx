// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
import type { Metadata } from "next";
import { ContentPageView } from "@/components/ContentPageView";
import { loadLang } from "@/i18n";
import { getPage } from "@/lib/content";

export async function generateMetadata({ params }: PageProps<"/[lang]/privacidade">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const page = getPage("privacidade", lang);
  return { title: page.title, description: page.lead };
}

export default async function Page({ params }: PageProps<"/[lang]/privacidade">) {
  const { lang, t } = await loadLang(params);
  return <ContentPageView slug="privacidade" lang={lang} t={t} />;
}
