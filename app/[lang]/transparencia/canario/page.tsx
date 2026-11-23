// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { ContentPageView } from "@/components/ContentPageView";
import { CanarioAtual } from "@/components/transparencia/Paineis";
import { loadLang } from "@/i18n";
import { getPage } from "@/lib/content";
import { paginaMeta } from "@/lib/seo";
import { canario } from "@/lib/transparencia";

export async function generateMetadata({ params }: PageProps<"/[lang]/transparencia/canario">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const page = getPage("transparencia-canario", lang);
  return paginaMeta(lang, "/transparencia/canario", page.title, page.lead);
}

/** O canário (content/transparencia/canario.md), assinado pelo fluxo de publicação com o Sigstore. */
export default async function Page({ params }: PageProps<"/[lang]/transparencia/canario">) {
  const { lang, t } = await loadLang(params);
  return (
    <ContentPageView slug="transparencia-canario" lang={lang} t={t}>
      <CanarioAtual lang={lang} c={canario()} />
    </ContentPageView>
  );
}
