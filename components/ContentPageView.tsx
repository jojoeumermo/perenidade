// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import Link from "next/link";
import { localePath, type Locale } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import { getPage } from "@/lib/content";
import { Markdown } from "./Markdown";
import { Cartaz, type Tom } from "./Cartaz";
import { PageHeading } from "./PageHeading";
import { originalLang, Untranslated } from "./Untranslated";

/** Página de texto corrido vinda de content/paginas (sobre, voluntários, linha do tempo, guia de fontes). */
/** Com "tone", a página abre no desenho de cartaz do jornal (veja Cartaz); sem ele, no título simples. */
export function ContentPageView({ slug, lang, t, tone, children }: { slug: string; lang: Locale; t: Dict; tone?: Tom; children?: React.ReactNode }) {
  const page = getPage(slug, lang);
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div {...originalLang(page.translated)}>
        {tone ? (
          <Cartaz eyebrow={page.eyebrow} title={page.title} slogan={t.footer.slogan} tone={tone}>
            {page.lead}
          </Cartaz>
        ) : (
          <PageHeading eyebrow={page.eyebrow} title={page.title}>
            {page.lead}
          </PageHeading>
        )}
      </div>
      <Untranslated lang={lang} t={t} show={!page.translated} />
      <div className="mt-8" {...originalLang(page.translated)}>
        <Markdown lang={lang}>{page.body}</Markdown>
      </div>
      {children}
      <p className="no-print mt-10 border-t border-rule pt-6 font-sans text-sm text-ink-soft">
        <Link href={`${localePath(lang, "/contribuir")}?corrigir=${encodeURIComponent(`/${slug}`)}`} className="underline hover:text-oxblood">
          {t.common.suggestFix}
        </Link>
      </p>
    </div>
  );
}
