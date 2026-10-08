// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/PageHeading";
import { originalLang, Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { htmlLang, localePath } from "@/i18n/config";
import { getArticles } from "@/lib/content";

export async function generateMetadata({ params }: PageProps<"/[lang]/jornal">): Promise<Metadata> {
  const { t } = await loadLang(params);
  return { title: t.journal.title, description: t.journal.lead };
}

export default async function Jornal({ params }: PageProps<"/[lang]/jornal">) {
  const { lang, t } = await loadLang(params);
  const articles = getArticles(lang);
  const date = new Intl.DateTimeFormat(htmlLang[lang], { dateStyle: "long", timeZone: "UTC" });
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <PageHeading eyebrow={t.journal.eyebrow} title={t.journal.title}>
        {t.journal.lead}
      </PageHeading>
      <Untranslated lang={lang} t={t} show={articles.some((article) => !article.translated)} />
      {articles.length === 0 && <p className="mt-10 text-xl text-ink-soft">{t.journal.empty}</p>}
      <ul className="mt-10 divide-y divide-rule border-y border-rule">
        {articles.map((article) => (
          <li key={article.slug} {...originalLang(article.translated)}>
            <Link href={localePath(lang, `/jornal/${article.slug}`)} className="group block py-6">
              <p className="font-mono text-xs text-gold">
                {date.format(new Date(article.date))}
                {article.section && ` · ${article.section}`}
              </p>
              <h2 className="mt-1 text-3xl font-semibold group-hover:text-oxblood">{article.title}</h2>
              {article.subtitle && <p className="mt-1 text-xl text-ink-soft">{article.subtitle}</p>}
              <p className="mt-2 font-sans text-sm text-ink-soft">{article.author}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
