// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
import type { Metadata } from "next";
import Link from "next/link";
import { Masthead } from "@/components/Masthead";
import { originalLang, Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { fill, htmlLang, localePath } from "@/i18n/config";
import { getArticles, type Article } from "@/lib/content";

export async function generateMetadata({ params }: PageProps<"/[lang]/jornal">): Promise<Metadata> {
  const { t } = await loadLang(params);
  return { title: t.journal.title, description: t.journal.lead };
}

/** Primeiro parágrafo da matéria, sem marcação, para a chamada da capa. */
const opening = (article: Article) =>
  (article.body.split(/\n{2,}/).find((block) => block.trim() && !/^[#>!\-|`]/.test(block.trim())) ?? "")
    .replace(/[*_`]|\[([^\]]+)\]\([^)]*\)/g, "$1")
    .trim()
    .slice(0, 420);

// A capa do jornal: manchete, duas chamadas e as demais notícias, como em uma primeira página impressa.
export default async function Jornal({ params }: PageProps<"/[lang]/jornal">) {
  const { lang, t } = await loadLang(params);
  const s = t.journal;
  const articles = getArticles(lang);
  const date = new Intl.DateTimeFormat(htmlLang[lang], { dateStyle: "long", timeZone: "UTC" });
  const to = (slug: string) => localePath(lang, `/jornal/${slug}`);
  const [lead, ...rest] = articles;
  const calls = rest.slice(0, 2);
  const others = rest.slice(2);
  const byline = (article: Article) => (
    <p className="mt-2 font-sans text-xs uppercase tracking-wide text-ink-soft">
      {article.author} · {date.format(new Date(article.date))}
    </p>
  );
  const label = (article: Article) => article.section && <span className="jornal-editoria">{article.section}</span>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Masthead lang={lang} s={s} updated={lead ? fill(s.updated, { date: date.format(new Date(lead.date)) }) : undefined} />
      <p className="mt-3 text-lg text-ink-soft">{s.lead}</p>
      <Untranslated lang={lang} t={t} show={articles.some((article) => !article.translated)} />
      {!lead && <p className="mt-10 border-y-2 border-ink py-10 text-center text-3xl font-bold">{s.empty}</p>}

      {lead && (
        <article className="mt-6 border-b-2 border-ink pb-6" {...originalLang(lead.translated)}>
          {label(lead)}
          <h2 className="jornal-manchete mt-2 text-4xl sm:text-6xl">
            <Link href={to(lead.slug)} className="hover:text-oxblood">{lead.title}</Link>
          </h2>
          {lead.subtitle && <p className="mt-3 text-2xl font-semibold text-ink-soft">{lead.subtitle}</p>}
          <p className="jornal-texto mt-4 text-lg">{opening(lead)}</p>
          {byline(lead)}
        </article>
      )}

      {calls.length > 0 && (
        <div className="grid gap-x-8 border-b-2 border-ink md:grid-cols-2">
          {calls.map((article, i) => (
            <article key={article.slug} className={`py-6 ${i === 0 ? "md:border-r md:border-rule md:pr-8" : ""}`} {...originalLang(article.translated)}>
              {label(article)}
              <h3 className="jornal-manchete mt-2 text-3xl">
                <Link href={to(article.slug)} className="hover:text-oxblood">{article.title}</Link>
              </h3>
              {article.subtitle && <p className="mt-2 text-lg text-ink-soft">{article.subtitle}</p>}
              {byline(article)}
            </article>
          ))}
        </div>
      )}

      {others.length > 0 && (
        <section aria-labelledby="mais-noticias" className="mt-6">
          <h2 id="mais-noticias" className="jornal-editoria">{s.more}</h2>
          <ul className="mt-2 divide-y divide-rule">
            {others.map((article) => (
              <li key={article.slug} className="py-4" {...originalLang(article.translated)}>
                <h3 className="jornal-manchete text-2xl">
                  <Link href={to(article.slug)} className="hover:text-oxblood">{article.title}</Link>
                </h3>
                {article.subtitle && <p className="mt-1 text-ink-soft">{article.subtitle}</p>}
                {byline(article)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
