// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "@/components/Link";
import { GuiaDeDireitos } from "@/components/governanca/Governanca";
import { Markdown } from "@/components/Markdown";
import { PageHeading } from "@/components/PageHeading";
import { originalLang, Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { getPage } from "@/lib/content";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/direitos">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const page = getPage("direitos", lang);
  return paginaMeta(lang, "/direitos", page.title, page.lead);
}

// O guia de direitos, mais largo que as páginas de texto corrido: as teclas de emergência e os cartões dos serviços em colunas.
export default async function Direitos({ params }: PageProps<"/[lang]/direitos">) {
  const { lang, t } = await loadLang(params);
  const page = getPage("direitos", lang);
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div {...originalLang(page.translated)}>
        <PageHeading eyebrow={page.eyebrow} title={page.title}>
          {page.lead}
        </PageHeading>
      </div>
      <Untranslated lang={lang} t={t} show={!page.translated} />
      <div className="mt-8 max-w-3xl" {...originalLang(page.translated)}>
        <Markdown lang={lang}>{page.body}</Markdown>
      </div>
      <div lang="pt-BR">
        <GuiaDeDireitos />
      </div>
      <p className="no-print mt-10 border-t border-rule pt-6 font-sans text-sm text-ink-soft">
        <Link href={`${localePath(lang, "/contribuir")}?corrigir=${encodeURIComponent("/direitos")}`} className="underline hover:text-oxblood">
          {t.common.suggestFix}
        </Link>
      </p>
    </div>
  );
}
