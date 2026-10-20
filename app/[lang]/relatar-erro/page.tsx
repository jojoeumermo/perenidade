// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { PageHeading } from "@/components/PageHeading";
import { RelatarErro } from "@/components/RelatarErro";
import { Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/relatar-erro">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/relatar-erro", t.bugs.title, t.bugs.description);
}

export default async function RelatarErroPage({ params }: PageProps<"/[lang]/relatar-erro">) {
  const { lang, t } = await loadLang(params);
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <PageHeading eyebrow={t.bugs.eyebrow} title={t.bugs.title}>
        {t.bugs.lead}
      </PageHeading>
      <Untranslated lang={lang} t={t} show={lang !== "pt"} />
      <div lang="pt-BR">
        <RelatarErro />
      </div>
    </div>
  );
}
