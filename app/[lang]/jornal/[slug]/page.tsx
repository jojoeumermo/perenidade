// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SourceList } from "@/components/Cards";
import { Markdown } from "@/components/Markdown";
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
    <article className="mx-auto max-w-3xl px-4 py-12">
      <Link href={localePath(lang, "/jornal")} className="no-print font-sans text-sm text-ink-soft hover:text-oxblood">← {t.journal.title}</Link>
      <div {...originalLang(article.translated)}>
        <p className="mt-6 font-mono text-xs uppercase tracking-[0.3em] text-gold">{article.section || t.journal.eyebrow}</p>
        <h1 className="mt-2 text-4xl font-semibold sm:text-5xl">{article.title}</h1>
        {article.subtitle && <p className="mt-3 text-2xl text-ink-soft">{article.subtitle}</p>}
        <p className="mt-5 font-sans text-sm text-ink-soft">
          {fill(t.lesson.by, { names: article.author })} · {date.format(new Date(article.date))} · {fill(t.tracks.minutes, { n: article.minutes })}
        </p>
      </div>
      <Untranslated lang={lang} t={t} show={!article.translated} />
      <div {...originalLang(article.translated)}>
        <div className="mt-8">
          <Markdown lang={lang} terms={terms}>{article.body}</Markdown>
        </div>
        <SourceList sources={article.sources} title={t.common.sources} />
      </div>
    </article>
  );
}
