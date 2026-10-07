import type { Locale } from "@/i18n/config";
import type { Dict } from "@/i18n/pt";
import { getPage } from "@/lib/content";
import { github } from "@/lib/site";
import { Markdown } from "./Markdown";
import { PageHeading } from "./PageHeading";
import { originalLang, Untranslated } from "./Untranslated";

/** Página de texto corrido vinda de content/paginas (sobre, voluntários, glossário, linha do tempo). */
export function ContentPageView({ slug, lang, t, children }: { slug: string; lang: Locale; t: Dict; children?: React.ReactNode }) {
  const page = getPage(slug, lang);
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div {...originalLang(page.translated)}>
        <PageHeading eyebrow={page.eyebrow} title={page.title}>
          {page.lead}
        </PageHeading>
      </div>
      <Untranslated lang={lang} t={t} show={!page.translated} />
      <div className="mt-8" {...originalLang(page.translated)}>
        <Markdown lang={lang}>{page.body}</Markdown>
      </div>
      {children}
      <p className="no-print mt-10 border-t border-rule pt-6 font-sans text-sm text-ink-soft">
        <a href={github.edit(page.file)} target="_blank" rel="noopener noreferrer" className="underline hover:text-oxblood">
          {t.common.suggestFix}
        </a>
      </p>
    </div>
  );
}
