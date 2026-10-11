// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SourceList } from "@/components/Cards";
import { Markdown } from "@/components/Markdown";
import { Masthead } from "@/components/Masthead";
import { originalLang, Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { defaultLocale, fill, htmlLang, localePath } from "@/i18n/config";
import { getArticles, getGlossary } from "@/lib/content";
import { withLangs } from "@/lib/params";

export const dynamicParams = false;

export function generateStaticParams() {
  // Com o jornal ainda vazio, uma página de espera mantém a rota válida.
  const slugs = getArticles(defaultLocale).map((article) => ({ slug: article.slug }));
  return withLangs(slugs.length > 0 ? slugs : [{ slug: "em-breve" }]);
}

export async function generateMetadata({ params }: PageProps<"/[lang]/jornal/[slug]">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const { slug } = await params;
  const article = getArticles(lang).find((item) => item.slug === slug);
  return article ? { title: article.title, description: article.subtitle } : {};
}

export default async function Materia({ params }: PageProps<"/[lang]/jornal/[slug]">) {
  const { lang, t } = await loadLang(params);
  const { slug } = await params;
  const article = getArticles(lang).find((item) => item.slug === slug);
  if (!article) notFound();
  const date = new Intl.DateTimeFormat(htmlLang[lang], { dateStyle: "long", timeZone: "UTC" });
  const terms = article.translated ? getGlossary(lang).filter((term) => term.translated).map(({ slug: s, term, summary }) => ({ slug: s, term, summary })) : [];

  return (
    <article className="mx-auto max-w-3xl px-4 py-8">
      <Masthead lang={lang} s={t.journal} small />
      <div className="mt-6" {...originalLang(article.translated)}>
        <span className="jornal-editoria">{article.section || t.journal.eyebrow}</span>
        <h1 className="jornal-manchete mt-3 text-4xl sm:text-6xl">{article.title}</h1>
        {article.subtitle && <p className="mt-4 text-2xl font-semibold text-ink-soft">{article.subtitle}</p>}
        <p className="mt-5 border-y border-ink py-2 font-sans text-xs font-semibold uppercase tracking-wide">
          {fill(t.lesson.by, { names: article.author })} · {date.format(new Date(article.date))} · {fill(t.tracks.minutes, { n: article.minutes })}
        </p>
      </div>
      <Untranslated lang={lang} t={t} show={!article.translated} />
      <div {...originalLang(article.translated)}>
        <div className="jornal-materia mt-8">
          <Markdown lang={lang} terms={terms}>{article.body}</Markdown>
        </div>
        <SourceList sources={article.sources} title={t.common.sources} />
      </div>
      <p className="no-print mt-10 border-t-4 border-ink pt-4 font-sans text-sm">
        <Link href={localePath(lang, "/jornal")} className="font-semibold uppercase tracking-wide hover:text-oxblood">← {t.journal.back}</Link>
      </p>
    </article>
  );
}
