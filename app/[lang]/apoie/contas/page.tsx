// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { Contas } from "@/components/apoie/Contas";
import { Cartaz } from "@/components/Cartaz";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/apoie/contas">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/apoie/contas", t.support.page.accounts.title, t.support.page.accounts.lead);
}

/** A prestação de contas: os relatórios mensais publicados pela coordenação, com gráfico e tabela. */
export default async function ApoieContas({ params }: PageProps<"/[lang]/apoie/contas">) {
  const { lang, t } = await loadLang(params);
  const a = t.support.page.accounts;
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <Cartaz eyebrow={t.support.eyebrow} title={a.title} slogan={t.slogans.apoie} tone="raios">
        {a.lead}
      </Cartaz>
      <Contas lang={lang} p={t.support.page} />
    </div>
  );
}
