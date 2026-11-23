// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { ContentPageView } from "@/components/ContentPageView";
import { ListaDePedidos } from "@/components/transparencia/Paineis";
import { loadLang } from "@/i18n";
import { getPage } from "@/lib/content";
import { paginaMeta } from "@/lib/seo";
import { pedidosDeOrgaos } from "@/lib/transparencia";

export async function generateMetadata({ params }: PageProps<"/[lang]/transparencia/pedidos">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const page = getPage("transparencia-pedidos", lang);
  return paginaMeta(lang, "/transparencia/pedidos", page.title, page.lead);
}

/** Cada pedido de órgão público e o que foi entregue (content/transparencia/pedidos.json). */
export default async function Page({ params }: PageProps<"/[lang]/transparencia/pedidos">) {
  const { lang, t } = await loadLang(params);
  return (
    <ContentPageView slug="transparencia-pedidos" lang={lang} t={t}>
      <ListaDePedidos lang={lang} dados={pedidosDeOrgaos()} />
    </ContentPageView>
  );
}
