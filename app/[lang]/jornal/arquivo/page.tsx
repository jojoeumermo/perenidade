// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { Arquivo } from "@/components/jornal/Arquivo";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/jornal/arquivo">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/jornal/arquivo", `${t.journal.archiveTitle} · ${t.journal.title}`, t.journal.archiveLead);
}

/** O arquivo do Jornal: o destaque fixo no topo e todas as matérias, da mais nova para a mais antiga. */
export default async function ArquivoDoJornal({ params }: PageProps<"/[lang]/jornal/arquivo">) {
  const { lang, t } = await loadLang(params);
  return <Arquivo lang={lang} t={t} />;
}
