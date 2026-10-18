// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { CadernoDeEstudos } from "@/components/caderno/Caderno";
import { Cartaz } from "@/components/Cartaz";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/caderno">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/caderno", t.notebook.title, t.notebook.description);
}

/** O caderno de estudos: a sala para estudar com todas as ferramentas à mão, de graça e sem conta. */
export default async function Caderno({ params }: PageProps<"/[lang]/caderno">) {
  const { t } = await loadLang(params);
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <Cartaz eyebrow={t.notebook.eyebrow} title={t.notebook.title} slogan={t.slogans.caderno} tone="preto">
        {t.notebook.lead}
      </Cartaz>
      <CadernoDeEstudos s={t.notebook} />
    </div>
  );
}
