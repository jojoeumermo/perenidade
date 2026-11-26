// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { notFound } from "next/navigation";
import { SourceList } from "@/components/Cards";
import Link from "@/components/Link";
import { Markdown } from "@/components/Markdown";
import { ContarLeitura } from "@/components/jornal/MaisLidas";
import { originalLang, Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { defaultLocale, fill, htmlLang, localePath } from "@/i18n/config";
import { getArticles, getGlossary } from "@/lib/content";
import { leiaTambem } from "@/lib/jornal/selecao";
import { withLangs } from "@/lib/params";

// O endereço de cada matéria é permanente: nenhuma expira (docs/jornal/EXPIRACAO.md). Mesma regra da página do site.
export const dynamicParams = false;

export function generateStaticParams() {
  const slugs = getArticles(defaultLocale).map((article) => ({ slug: article.slug }));
  return withLangs(slugs.length > 0 ? slugs : [{ slug: "em-breve" }]);
}

/**
 * A matéria inteira dentro do aplicativo (aba Eu → Jornal): editoria, manchete, linha fina, assinatura e data, foto de
 * capa, o texto numa coluna de leitura, fontes e "Leia também" (que também abre dentro do app). O arquivo de matérias
 * ainda abre na página do site: pendência registrada.
 */
export default async function MateriaDoApp({ params }: PageProps<"/[lang]/app/eu/jornal/[slug]">) {
  const { lang, t } = await loadLang(params);
  const { slug } = await params;
  const articles = getArticles(lang);
  const article = articles.find((item) => item.slug === slug);
  if (!article) notFound();
  const s = t.journal;
  const data = new Intl.DateTimeFormat(htmlLang[lang], { dateStyle: "long", timeZone: "UTC" });
  const curta = new Intl.DateTimeFormat(htmlLang[lang], { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const terms = article.translated ? getGlossary(lang).filter((term) => term.translated).map(({ slug: sl, term, summary }) => ({ slug: sl, term, summary })) : [];
  const outras = leiaTambem(articles, article.slug);
  const para = (sl: string) => localePath(lang, `/app/eu/jornal/${sl}`);
  return (
    <article className="app-hub app-materia-tela">
      <ContarLeitura slug={article.slug} />
      <header className="app-materia-cabeca" {...originalLang(article.translated)}>
        <p className="app-materia-editoria">{article.section || s.eyebrow}</p>
        <h1>{article.title}</h1>
        {article.subtitle && <p className="app-materia-linha-fina">{article.subtitle}</p>}
        <p className="app-materia-assinatura">
          {fill(t.lesson.by, { names: article.author })} · <time dateTime={article.date}>{data.format(new Date(article.date))}</time> · {fill(t.tracks.minutes, { n: article.minutes })}
        </p>
      </header>
      {article.image ? (
        <figure className="app-materia-capa">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={article.image} alt="" width={1600} height={900} decoding="async" />
          {article.imageCredit && <figcaption>{article.imageCredit}</figcaption>}
        </figure>
      ) : null}
      <Untranslated lang={lang} t={t} show={!article.translated} />
      <div className="app-materia-texto jornal-materia" {...originalLang(article.translated)}>
        <Markdown lang={lang} terms={terms}>{article.body}</Markdown>
        <SourceList sources={article.sources} title={t.common.sources} />
      </div>
      {outras.length > 0 && (
        <section aria-labelledby="app-leia-tambem">
          <h2 id="app-leia-tambem" className="app-titulo-secao">{s.alsoRead}</h2>
          <ul className="app-jornal-lista">
            {outras.map((a) => (
              <li key={a.slug}>
                <Link href={para(a.slug)} className="app-cartao app-jornal-materia" data-materia={a.slug}>
                  <span className="app-cartao-titulo app-cartao-titulo-menor">{a.title}</span>
                  <span className="app-cartao-aux">{curta.format(new Date(a.date))}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <Link href={localePath(lang, "/jornal/arquivo")} className="app-cartao app-jornal-materia">
        <span className="app-cartao-titulo app-cartao-titulo-menor">{s.archive}</span>
        <span className="app-cartao-texto">O arquivo abre na página do site.</span>
      </Link>
    </article>
  );
}
