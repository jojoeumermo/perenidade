// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "next/link";
import { ContentPageView } from "@/components/ContentPageView";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { getPage } from "@/lib/content";

export async function generateMetadata({ params }: PageProps<"/[lang]/linha-do-tempo">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const page = getPage("linha-do-tempo", lang);
  return { title: page.title, description: page.lead };
}

export default async function Page({ params }: PageProps<"/[lang]/linha-do-tempo">) {
  const { lang, t } = await loadLang(params);
  return (
    <ContentPageView slug="linha-do-tempo" lang={lang} t={t} tone="preto" indice>
      <p className="no-print mt-8">
        <Link href={`${localePath(lang, "/contribuir")}?tipo=sugestao`} className="inline-block border-2 border-ink px-4 py-2 font-sans text-sm font-medium hover:border-oxblood hover:text-oxblood">{t.lists.suggestFact} →</Link>
      </p>
    </ContentPageView>
  );
}
