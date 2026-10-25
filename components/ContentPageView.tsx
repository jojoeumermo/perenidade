// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import GithubSlugger from "github-slugger";
import Link from "@/components/Link";
import { localePath, type Locale } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import { getPage } from "@/lib/content";
import { Markdown } from "./Markdown";
import { Cartaz, type Tom } from "./Cartaz";
import { PageHeading } from "./PageHeading";
import { originalLang, Untranslated } from "./Untranslated";

/** Página de texto corrido vinda de content/paginas (sobre, voluntários, linha do tempo, guia de fontes). */
/** Com "tone", a página abre no desenho de cartaz do jornal (veja Cartaz); sem ele, no título simples. */
function secoes(body: string): { id: string; title: string }[] {
  const slugger = new GithubSlugger();
  return body
    .replace(/```[\s\S]*?```/g, "")
    .split("\n")
    .flatMap((line) => {
      const match = /^## (.+)$/.exec(line);
      if (!match) return [];
      const title = match[1].replace(/[*_`]/g, "").trim();
      return [{ id: slugger.slug(title), title }];
    });
}

export function ContentPageView({ slug, lang, t, tone, indice = false, children }: { slug: string; lang: Locale; t: Dict; tone?: Tom; /** Índice clicável das seções no topo (páginas longas). */ indice?: boolean; children?: React.ReactNode }) {
  const page = getPage(slug, lang);
  const indices = indice ? secoes(page.body) : [];
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
      {indices.length > 2 && (
        <nav aria-label={page.title} className="no-print mt-8 border-l-4 border-gold bg-parchment-deep px-4 py-3 font-sans text-sm" {...originalLang(page.translated)}>
          <ol className="columns-1 gap-6 sm:columns-2">
            {indices.map((item, i) => (
              <li key={item.id} className="py-0.5">
                <a href={`#${item.id}`} className="hover:text-oxblood"><span className="font-mono text-xs text-gold">{i + 1}.</span> {item.title}</a>
              </li>
            ))}
          </ol>
        </nav>
      )}
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
