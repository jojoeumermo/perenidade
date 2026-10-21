// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { ContentPageView } from "@/components/ContentPageView";
import { ConfiguracoesDoCantinho } from "@/components/criancas/comum";
import { loadLang } from "@/i18n";
import { getPage } from "@/lib/content";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/criancas/adultos">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const page = getPage("criancas-adultos", lang);
  return paginaMeta(lang, "/criancas/adultos", page.title, page.lead);
}

export default async function ParaAdultos({ params }: PageProps<"/[lang]/criancas/adultos">) {
  const { lang, t } = await loadLang(params);
  return (
    <ContentPageView slug="criancas-adultos" lang={lang} t={t}>
      <section className="mt-10 border-[3px] border-ink bg-parchment-deep p-5">
        <h2 className="text-2xl font-semibold">Configurações do Cantinho neste aparelho</h2>
        <div className="mt-3"><ConfiguracoesDoCantinho /></div>
      </section>
    </ContentPageView>
  );
}
