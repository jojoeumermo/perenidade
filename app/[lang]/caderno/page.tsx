// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { CadernoDeEstudos } from "@/components/caderno/Caderno";
import { Cartaz } from "@/components/Cartaz";
import { loadLang } from "@/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/caderno">): Promise<Metadata> {
  const { t } = await loadLang(params);
  return { title: t.notebook.title, description: t.notebook.description };
}

/** O caderno de estudos: a sala para estudar com todas as ferramentas à mão, de graça e sem conta. */
export default async function Caderno({ params }: PageProps<"/[lang]/caderno">) {
  const { t } = await loadLang(params);
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <Cartaz eyebrow={t.notebook.eyebrow} title={t.notebook.title} slogan={t.footer.slogan} tone="preto">
        {t.notebook.lead}
      </Cartaz>
      <CadernoDeEstudos s={t.notebook} />
    </div>
  );
}
