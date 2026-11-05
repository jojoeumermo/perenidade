// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { LabsExternos } from "@/components/labs/LabsExternos";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";

const TITULO: Record<string, string> = { pt: "Laboratórios abertos de fora", en: "Open labs from elsewhere" };
const LEAD: Record<string, string> = {
  pt: "Simuladores, explorables e ferramentas feitos por outras pessoas e instituições, com licença livre ou aberta, sempre com crédito. Nada carrega antes de você abrir, e o nosso site não rastreia você (os de fora, depois de abertos, seguem as regras de quem os mantém).",
  en: "Simulators, explorables and tools made by other people and institutions, under free or open licences, always credited. Nothing loads before you open it, and our site does not track you (outside labs, once open, follow their own maintainers' rules).",
};

export async function generateMetadata({ params }: PageProps<"/[lang]/laboratorios/externos">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  return paginaMeta(lang, "/laboratorios/externos", TITULO[lang] ?? TITULO.en, LEAD[lang] ?? LEAD.en);
}

export default async function Page({ params }: PageProps<"/[lang]/laboratorios/externos">) {
  const { lang, t } = await loadLang(params);
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <PageHeading eyebrow={t.labs.title} title={TITULO[lang] ?? TITULO.en}>
        {LEAD[lang] ?? LEAD.en}
      </PageHeading>
      <LabsExternos />
    </div>
  );
}
