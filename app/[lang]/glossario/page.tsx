// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "next/link";
import { Markdown } from "@/components/Markdown";
import { PageHeading } from "@/components/PageHeading";
import { originalLang, Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { getGlossary } from "@/lib/content";

export async function generateMetadata({ params }: PageProps<"/[lang]/glossario">): Promise<Metadata> {
  const { t } = await loadLang(params);
  return { title: t.glossary.title, description: t.glossary.lead };
}

export default async function Glossario({ params }: PageProps<"/[lang]/glossario">) {
  const { lang, t } = await loadLang(params);
  const terms = getGlossary(lang);
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <PageHeading eyebrow={t.glossary.eyebrow} title={t.glossary.title}>
        {t.glossary.lead}
      </PageHeading>
      <Untranslated lang={lang} t={t} show={terms.some((term) => !term.translated)} />
      <nav aria-label={t.glossary.title} className="mt-8 flex flex-wrap gap-x-4 gap-y-1 font-sans text-sm">
        {terms.map((term) => (
          <a key={term.slug} href={`#${term.slug}`} className="underline hover:text-oxblood" {...originalLang(term.translated)}>{term.term}</a>
        ))}
      </nav>
      <dl className="mt-10 space-y-8">
        {terms.map((term) => (
          <div key={term.slug} id={term.slug} className="scroll-mt-6 border-l-2 border-gold pl-5" {...originalLang(term.translated)}>
            <dt className="text-3xl font-semibold">{term.term}</dt>
            <dd className="mt-2">
              <p className="text-xl italic text-ink-soft">{term.summary}</p>
              {term.body && (
                <div className="mt-3">
                  <Markdown lang={lang}>{term.body}</Markdown>
                </div>
              )}
            </dd>
          </div>
        ))}
      </dl>
      <p className="no-print mt-10 border-t border-rule pt-6 font-sans text-sm text-ink-soft">
        {t.glossary.missing}{" "}
        <Link href={localePath(lang, "/contribuir")} className="underline hover:text-oxblood">{t.nav.contribute}</Link>.
      </p>
    </div>
  );
}
