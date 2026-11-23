// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { ContentPageView } from "@/components/ContentPageView";
import { ListaDoQueGuardamos } from "@/components/transparencia/Paineis";
import { loadLang } from "@/i18n";
import { getPage } from "@/lib/content";
import { paginaMeta } from "@/lib/seo";
import { inventario } from "@/lib/transparencia";

export async function generateMetadata({ params }: PageProps<"/[lang]/transparencia/o-que-o-servidor-guarda">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const page = getPage("transparencia-o-que-o-servidor-guarda", lang);
  return paginaMeta(lang, "/transparencia/o-que-o-servidor-guarda", page.title, page.lead);
}

/** A lista completa do que o servidor guarda, gerada do banco (scripts/ferramentas/inventario-do-banco.mjs). */
export default async function Page({ params }: PageProps<"/[lang]/transparencia/o-que-o-servidor-guarda">) {
  const { lang, t } = await loadLang(params);
  return (
    <ContentPageView slug="transparencia-o-que-o-servidor-guarda" lang={lang} t={t}>
      <ListaDoQueGuardamos dados={inventario()} />
    </ContentPageView>
  );
}
