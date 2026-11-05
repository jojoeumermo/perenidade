// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { ImprensaForm } from "@/components/ImprensaForm";
import { PageHeading } from "@/components/PageHeading";
import { Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";

const TITULO = "Imprensa";
const DESCRICAO = "Jornalistas: peça uma entrevista, uma informação ou uma nota ao instituto. O pedido vai direto para a pessoa que fala pelo instituto.";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await loadLang(params);
  return paginaMeta(lang, "/imprensa", TITULO, DESCRICAO);
}

export default async function ImprensaPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang, t } = await loadLang(params);
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <PageHeading eyebrow="Para jornalistas" title={TITULO}>
        {DESCRICAO}
      </PageHeading>
      <Untranslated lang={lang} t={t} show={lang !== "pt"} />
      <div lang="pt-BR">
        <ImprensaForm />
      </div>
    </div>
  );
}
