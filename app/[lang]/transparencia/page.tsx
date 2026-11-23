// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { ContentPageView } from "@/components/ContentPageView";
import { loadLang } from "@/i18n";
import { getPage } from "@/lib/content";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/transparencia">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const page = getPage("transparencia", lang);
  return paginaMeta(lang, "/transparencia", page.title, page.lead);
}

/** A porta das páginas de transparência (onda R3, item 3.2): o que o servidor guarda, os pedidos de órgãos públicos, o relatório trimestral, o canário e as auditorias. */
export default async function Page({ params }: PageProps<"/[lang]/transparencia">) {
  const { lang, t } = await loadLang(params);
  return (
    <ContentPageView slug="transparencia" lang={lang} t={t} />
  );
}
