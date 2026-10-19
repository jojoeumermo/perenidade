// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { Escritorio } from "@/components/labs/Escritorio";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/laboratorios/escritorio">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/laboratorios/escritorio", t.labs.escritorio, t.labs.escritorioLead);
}

/** Texto, planilha e apresentação: o WordCraft, o GridCraft e o DeckCraft abertos dentro da página. */
export default async function Page({ params }: PageProps<"/[lang]/laboratorios/escritorio">) {
  const { t } = await loadLang(params);
  const s = t.practiceStudio;
  return (
    <div className="mx-auto max-w-[96rem] px-4 py-12">
      <PageHeading eyebrow={t.labs.title} title={t.labs.escritorio}>
        {t.labs.escritorioIntro}
      </PageHeading>
      <Escritorio s={{ code: s.code, insideNote: s.insideNote, fullscreen: s.fullscreen, notYet: s.notYet, editors: s.editors, tab: t.labs.escritorioTab, local: t.labs.escritorioLocal }} />
    </div>
  );
}
