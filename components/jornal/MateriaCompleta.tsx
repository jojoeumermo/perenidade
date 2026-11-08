// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import Link from "@/components/Link";
import { SourceList } from "@/components/Cards";
import { Compartilhar } from "@/components/Compartilhar";
import { Markdown } from "@/components/Markdown";
import { Masthead, Star } from "@/components/Masthead";
import { ContarLeitura } from "@/components/jornal/MaisLidas";
import { originalLang, Untranslated } from "@/components/Untranslated";
import type { Dict } from "@/i18n/types";
import { fill, htmlLang, localePath, type Locale } from "@/i18n/config";
import { getGlossary, type Article } from "@/lib/content";
import { leiaTambem, materiaEmDestaque } from "@/lib/jornal/selecao";
import { site } from "@/lib/site";

/**
 * A matéria inteira, como no jornal: chapéu da editoria, manchete grande, linha fina, assinatura e data, a foto de capa
 * (se houver) na largura toda e o texto numa coluna de leitura (~68 caracteres). Ao lado, no computador, a matéria em
 * destaque fixo; no celular ela desce para o fim. Depois, "Leia também" com as 3 mais recentes e o link do arquivo.
 * Usada por /jornal (a última matéria) e por /jornal/[slug].
 */
export function MateriaCompleta({ lang, t, article, articles, ultima = false }: { lang: Locale; t: Dict; article: Article; articles: Article[]; ultima?: boolean }) {
  const s = t.journal;
  const date = new Intl.DateTimeFormat(htmlLang[lang], { dateStyle: "long", timeZone: "UTC" });
  const curta = new Intl.DateTimeFormat(htmlLang[lang], { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const to = (slug: string) => localePath(lang, `/jornal/${slug}`);
  const terms = article.translated ? getGlossary(lang).filter((term) => term.translated).map(({ slug, term, summary }) => ({ slug, term, summary })) : [];
  const destaque = materiaEmDestaque(articles);
  const lateral = destaque && destaque.slug !== article.slug ? destaque : undefined;
  const outras = leiaTambem(articles, article.slug);

  return (
    <article className="mx-auto max-w-[78rem] px-4 py-8 sm:px-6 lg:px-8">
      <ContarLeitura slug={article.slug} />
      <Masthead lang={lang} s={s} slogan={t.slogans.jornal} small />

      {/* ── Cabeçalho: chapéu, manchete, linha fina, assinatura ── */}
      <header className="mt-8 max-w-5xl" {...originalLang(article.translated)}>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="jornal-editoria">{article.section || s.eyebrow}</span>
          {ultima && <span className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-prelo-texto">{s.latest}</span>}
        </p>
        <h1 className="jornal-manchete mt-4 font-serif text-[2.35rem] sm:text-6xl lg:text-7xl">{article.title}</h1>
        {article.subtitle && <p className="mt-5 max-w-4xl font-serif text-xl leading-snug text-ink-soft sm:text-2xl">{article.subtitle}</p>}
        <p className="mt-6 border-y-2 border-ink py-2.5 font-mono text-[0.72rem] font-semibold uppercase tracking-[0.1em]">
          {fill(t.lesson.by, { names: article.author })} · <time dateTime={article.date}>{date.format(new Date(article.date))}</time> · {fill(t.tracks.minutes, { n: article.minutes })}
        </p>
      </header>

      {article.image ? (
        <figure className="mt-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={article.image} alt="" width={1600} height={900} decoding="async" className="aspect-[16/9] w-full border-2 border-ink object-cover shadow-[6px_6px_0_var(--sombra)]" />
          {article.imageCredit && <figcaption className="mt-2 font-mono text-[0.68rem] uppercase tracking-[0.08em] text-ink-soft">{article.imageCredit}</figcaption>}
        </figure>
      ) : null}

      <Untranslated lang={lang} t={t} show={!article.translated} />

      {/* ── O texto, numa coluna de leitura; ao lado, o destaque fixo ── */}
      <div className="mt-8 grid gap-12 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0 max-w-[68ch]" {...originalLang(article.translated)}>
          <div className="jornal-materia">
            <Markdown lang={lang} terms={terms}>{article.body}</Markdown>
          </div>
          <SourceList sources={article.sources} title={t.common.sources} />
          <Compartilhar url={`${site.url}${to(article.slug)}`} texto={`${t.compartilhar.materia} ${article.title}`} s={t.compartilhar} />
        </div>
        {lateral && (
          <aside aria-label={s.featured} className="no-print lg:border-l-2 lg:border-ink lg:pl-8">
            <div className="lg:sticky lg:top-24">
              <Link href={to(lateral.slug)} className="jornal-preto group relative block overflow-hidden border-2 border-ink p-5 text-[#f4ecd8] shadow-[6px_6px_0_var(--prelo)] hover:text-white" {...originalLang(lateral.translated)}>
                <Star className="pointer-events-none absolute -top-6 -right-6 h-20 w-20 rotate-12 text-[#c21f16]" />
                <span className="relative font-mono text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[#e0837a]">★ {s.featured}</span>
                <span className="relative mt-3 block font-serif text-[1.55rem] font-bold leading-[1.1] group-hover:underline">{lateral.title}</span>
                {lateral.subtitle && <span className="relative mt-3 block text-[0.95rem] leading-snug text-[#e9dfc6] line-clamp-5">{lateral.subtitle}</span>}
                <span className="relative mt-3 block font-mono text-[0.68rem] uppercase tracking-[0.1em] text-[#e0837a]">{curta.format(new Date(lateral.date))}</span>
              </Link>
            </div>
          </aside>
        )}
      </div>

      {/* ── Leia também ── */}
      <section aria-labelledby="leia-tambem" className="no-print mt-14 border-t-4 border-ink pt-6">
        <h2 id="leia-tambem" className="flex items-center gap-3.5">
          <span className="bg-[#c21f16] px-3 py-1.5 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-white">★ {s.alsoRead}</span>
          <span aria-hidden className="flex-1 border-t-2 border-[#c21f16]" />
        </h2>
        {outras.length > 0 && (
          <ul className="mt-6 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
            {outras.map((a) => (
              <li key={a.slug} className="cartao flex flex-col p-5" {...originalLang(a.translated)}>
                <p className="font-mono text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-prelo-texto">{a.section || s.eyebrow}</p>
                <h3 className="mt-1.5 font-serif text-[1.4rem] font-semibold leading-[1.15]">
                  <Link href={to(a.slug)} className="text-ink hover:text-ink hover:underline hover:decoration-[#c21f16] hover:decoration-2">
                    {a.title}
                  </Link>
                </h3>
                {a.subtitle && <p className="mt-2 line-clamp-3 leading-snug text-ink-soft">{a.subtitle}</p>}
                <p className="mt-auto pt-3 font-mono text-[0.7rem] uppercase tracking-[0.1em] text-ink-soft">{curta.format(new Date(a.date))}</p>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-8">
          <Link href={localePath(lang, "/jornal/arquivo")} className="botao botao-tinta">
            {s.archive} →
          </Link>
        </p>
      </section>
    </article>
  );
}
