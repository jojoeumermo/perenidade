// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "next/link";
import { Masthead, Star } from "@/components/Masthead";
import { originalLang, Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { fill, htmlLang, localePath } from "@/i18n/config";
import { getArticles, type Article } from "@/lib/content";
import { Newsletter } from "@/components/Newsletter";

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

// A capa do jornal, no desenho dos cartazes e da imprensa operária: manchete com capitular, o quadro
// do giro de notícias ao lado, duas chamadas e as demais notícias em colunas, como numa primeira página.
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
    <p className="mt-3 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-ink-soft">
      {article.author} · {date.format(new Date(article.date))}
    </p>
  );
  const label = (article: Article) => article.section && <span className="jornal-editoria">{article.section}</span>;

  // O quadro do giro de notícias: o sol de raios vermelhos dos cartazes, com o convite para as manchetes do país.
  const giro = (
    <aside aria-labelledby="giro" className="jornal-raios no-print flex flex-col gap-3 p-6 sm:p-8">
      <Star className="h-9 w-9 text-white" />
      <h2 id="giro" className="font-sans text-3xl font-black uppercase italic leading-[0.92] tracking-tight sm:text-4xl">
        {s.newsletter.roundTitle}
      </h2>
      <p className="text-lg leading-snug">{s.newsletter.roundLead}</p>
      <Link
        href={localePath(lang, "/noticias")}
        className="mt-auto self-start border-2 border-white bg-white px-4 py-2.5 font-sans text-sm font-extrabold uppercase tracking-wide text-[#a51810] hover:bg-transparent hover:text-white"
      >
        {s.newsletter.roundButton} →
      </Link>
    </aside>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Masthead lang={lang} s={s} slogan={t.footer.slogan} updated={lead ? fill(s.updated, { date: date.format(new Date(lead.date)) }) : undefined} />
      <Untranslated lang={lang} t={t} show={articles.some((article) => !article.translated)} />

      {!lead && (
        <section className="mt-8 grid border-4 border-ink md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="jornal-preto relative overflow-hidden p-6 sm:p-10">
            <Star className="pointer-events-none absolute -top-8 -right-10 h-36 w-36 rotate-12 text-[#c21f16] md:top-auto md:-right-20 md:-bottom-32 md:h-80 md:w-80" />
            <p className="relative font-mono text-[0.7rem] uppercase tracking-[0.25em] text-[#d4a24c]">{s.eyebrow}</p>
            <p className="relative mt-5 max-w-lg font-sans text-4xl font-black uppercase italic leading-[0.92] tracking-tight sm:text-6xl">{s.empty}</p>
            <p className="relative mt-6 max-w-md text-lg leading-snug text-[#f4ecd8]">{s.lead}</p>
          </div>
          {giro}
        </section>
      )}

      {lead && (
        <>
          <p className="mt-4 text-center text-lg italic text-ink-soft">{s.lead}</p>
          <div className="mt-6 grid gap-8 border-b-4 border-ink pb-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <article {...originalLang(lead.translated)}>
              {label(lead)}
              <h2 className="jornal-manchete mt-3 text-5xl sm:text-7xl">
                <Link href={to(lead.slug)} className="hover:text-oxblood">{lead.title}</Link>
              </h2>
              {lead.subtitle && <p className="mt-4 border-l-4 border-[#c21f16] pl-4 text-2xl font-semibold leading-snug text-ink-soft">{lead.subtitle}</p>}
              <p className="jornal-texto jornal-capitular mt-5 text-lg leading-relaxed sm:columns-2 sm:gap-8">{opening(lead)}</p>
              {byline(lead)}
            </article>
            {giro}
          </div>
        </>
      )}

      {calls.length > 0 && (
        <div className="grid gap-x-8 border-b-4 border-ink md:grid-cols-2">
          {calls.map((article, i) => (
            <article key={article.slug} className={`py-6 ${i === 0 ? "md:border-r-2 md:border-ink md:pr-8" : ""}`} {...originalLang(article.translated)}>
              {label(article)}
              <h3 className="jornal-manchete mt-2 text-3xl sm:text-4xl">
                <Link href={to(article.slug)} className="hover:text-oxblood">{article.title}</Link>
              </h3>
              {article.subtitle && <p className="mt-2 text-lg leading-snug text-ink-soft">{article.subtitle}</p>}
              {byline(article)}
            </article>
          ))}
        </div>
      )}

      {others.length > 0 && (
        <section aria-labelledby="mais-noticias" className="mt-8">
          <h2 id="mais-noticias" className="jornal-secao">
            <span className="jornal-editoria">{s.more}</span>
          </h2>
          <ul className="mt-2 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((article) => (
              <li key={article.slug} className="border-b border-rule py-5" {...originalLang(article.translated)}>
                {label(article)}
                <h3 className="jornal-manchete mt-2 text-2xl">
                  <Link href={to(article.slug)} className="hover:text-oxblood">{article.title}</Link>
                </h3>
                {article.subtitle && <p className="mt-1 leading-snug text-ink-soft">{article.subtitle}</p>}
                {byline(article)}
              </li>
            ))}
          </ul>
        </section>
      )}
      <Newsletter s={s.newsletter} />
    </div>
  );
}
