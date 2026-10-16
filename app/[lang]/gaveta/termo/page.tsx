// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { ContentPageView } from "@/components/ContentPageView";
import { loadLang } from "@/i18n";
import { getPage } from "@/lib/content";

export async function generateMetadata({ params }: PageProps<"/[lang]/gaveta/termo">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const page = getPage("gaveta-termo", lang);
  return { title: page.title, description: page.lead };
}

// O termo de cessão da Gaveta Aberta, inteiro, numa página própria: o mesmo texto que aparece antes do envio.
export default async function Page({ params }: PageProps<"/[lang]/gaveta/termo">) {
  const { lang, t } = await loadLang(params);
  return <ContentPageView slug="gaveta-termo" lang={lang} t={t} />;
}
