// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { Capa, Corpo } from "@/components/pagina/Capa";
import { StatusDoSite } from "@/components/StatusDoSite";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/status">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/status", t.status.eyebrow, t.status.lead);
}

/** Se o site, o banco e a busca estão no ar, conferido do aparelho de quem abre a página. */
export default async function Status({ params }: PageProps<"/[lang]/status">) {
  const { lang, t } = await loadLang(params);
  return (
    <>
      <Capa rotulo={t.status.eyebrow} titulo={t.status.title}>{t.status.lead}</Capa>
      <Corpo largura="estreita">
        <StatusDoSite lang={lang} s={t.status} />
      </Corpo>
    </>
  );
}
