// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "next/link";
import { Markdown } from "@/components/Markdown";
import { PageHeading } from "@/components/PageHeading";
import { Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { GlossaryList } from "@/components/GlossaryList";
import { getGlossaryIndex } from "@/lib/content";

export async function generateMetadata({ params }: PageProps<"/[lang]/glossario">): Promise<Metadata> {
  const { t } = await loadLang(params);
  return { title: t.glossary.title, description: t.glossary.lead };
}

export default async function Glossario({ params }: PageProps<"/[lang]/glossario">) {
  const { lang, t } = await loadLang(params);
  const terms = getGlossaryIndex(lang);
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <PageHeading eyebrow={t.glossary.eyebrow} title={t.glossary.title}>
        {t.glossary.lead}
      </PageHeading>
      <Untranslated lang={lang} t={t} show={terms.some((term) => !term.translated)} />
      <GlossaryList
        s={t.glossary}
        items={terms.map((term) => ({
          slug: term.slug,
          term: term.term,
          summary: term.summary,
          areas: term.areas,
          lessons: term.lessons,
          original: !term.translated,
          body: term.body ? <Markdown lang={lang}>{term.body}</Markdown> : null,
        }))}
      />
      <p className="no-print mt-10 border-t border-rule pt-6 font-sans text-sm text-ink-soft">
        {t.glossary.missing}{" "}
        <Link href={localePath(lang, "/contribuir")} className="underline hover:text-oxblood">{t.nav.contribute}</Link>.
      </p>
    </div>
  );
}
