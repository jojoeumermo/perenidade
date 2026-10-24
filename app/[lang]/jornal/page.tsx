// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "next/link";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Star } from "@/components/Masthead";
import { MaisLidas } from "@/components/jornal/MaisLidas";
import { originalLang, Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";
import { fill, htmlLang, localePath } from "@/i18n/config";
import { getArticles, type Article } from "@/lib/content";
import { Newsletter } from "@/components/Newsletter";
import { slugify } from "@/lib/text";

export async function generateMetadata({ params }: PageProps<"/[lang]/jornal">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/jornal", t.journal.title, t.journal.lead);
}

/** Primeiro parágrafo da matéria, sem marcação, para a chamada da capa. */
const opening = (article: Article) =>
  (article.body.split(/\n{2,}/).find((block) => block.trim() && !/^[#>!\-|`]/.test(block.trim())) ?? "")
    .replace(/[*_`]|\[([^\]]+)\]\([^)]*\)/g, "$1")
    .trim()
    .slice(0, 420);

/**
 * A capa do Jornal Revolucionário Lúcia, como a primeira página de um jornal operário: o nome em letra de livro com a
 * régua da edição e das editorias, a manchete com capitular e, ao lado, as chamadas e a caixa preta das mais lidas;
 * depois uma faixa por editoria, o giro de notícias do país e o boletim na faixa vermelha. Sem matéria ainda, o cartaz
 * da estrela e dos raios avisa que a primeira edição está no prelo.
 */
export default async function Jornal({ params }: PageProps<"/[lang]/jornal">) {
  const { lang, t } = await loadLang(params);
  const s = t.journal;
  const articles = getArticles(lang);
  const date = new Intl.DateTimeFormat(htmlLang[lang], { dateStyle: "long", timeZone: "UTC" });
  const curta = new Intl.DateTimeFormat(htmlLang[lang], { day: "numeric", month: "short", timeZone: "UTC" });
  const to = (slug: string) => localePath(lang, `/jornal/${slug}`);
  const [lead, ...rest] = articles;
  const calls = rest.slice(0, 2);
  const naCapa = new Set([lead, ...calls].filter(Boolean).map((a) => a.slug));
  const editorias = [...new Set(articles.map((a) => a.section).filter(Boolean))];
  const faixas = editorias
    .map((nome) => ({ nome, id: `editoria-${slugify(nome)}`, itens: articles.filter((a) => a.section === nome && !naCapa.has(a.slug)).slice(0, 6) }))
    .filter((f) => f.itens.length > 0);
  const semEditoria = articles.filter((a) => !a.section && !naCapa.has(a.slug));
  const chamada = (a: Article) => ({ slug: a.slug, title: a.title, href: to(a.slug) });
  const assinatura = (a: Article) => (
    <p className="mt-3 font-mono text-[0.7rem] uppercase tracking-[0.1em] text-ink-soft">
      {fill(t.lesson.by, { names: a.author })} · {curta.format(new Date(a.date))} · {fill(t.tracks.minutes, { n: a.minutes })}
    </p>
  );
  const chapeu = (a: Article) => <p className="font-mono text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-prelo-texto">{a.section || s.eyebrow}</p>;

  // O giro de notícias: o sol de raios vermelhos dos cartazes, com o convite para as manchetes do país.
  const giro = (
    <Link href={localePath(lang, "/noticias")} className="jornal-raios no-print group flex flex-col gap-3 border-2 border-ink p-6 text-white shadow-[6px_6px_0_var(--sombra)] hover:text-white">
      <Star className="h-8 w-8 text-white" />
      <span className="font-sans text-3xl font-black uppercase italic leading-[0.92] tracking-tight">{s.newsletter.roundTitle}</span>
      <span className="text-lg leading-snug">{s.newsletter.roundLead}</span>
      <span className="mt-auto self-start border-2 border-white bg-white px-4 py-2.5 font-sans text-sm font-extrabold uppercase tracking-wide text-[#a51810] group-hover:bg-transparent group-hover:text-white">
        {s.newsletter.roundButton} →
      </span>
    </Link>
  );

  return (
    <>
      {/* ── O nome do jornal, a régua da edição e as editorias ── */}
      <section className="border-b-[5px] border-double border-ink">
        <div className="mx-auto max-w-[78rem] px-4 pt-8 pb-4 text-center sm:px-6 lg:px-8">
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.3em] text-ink-soft">
            {s.tagline} · {s.republish}
          </p>
          <h1 className="mt-2 font-serif text-[2.7rem] font-bold leading-[0.95] tracking-[-0.01em] sm:text-7xl lg:text-[5.4rem]">
            {s.nameTop} <span className="font-medium italic text-prelo-texto">{s.nameBottom}</span>
          </h1>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-y-2 border-ink py-2 font-mono text-xs uppercase tracking-[0.1em]">
            <span>{fill(s.edition, { n: articles.length || 0 })}</span>
            {editorias.length > 0 && (
              <nav aria-label={s.sections} className="flex flex-wrap justify-center gap-x-5 gap-y-1 tracking-[0.12em]">
                <a href="#capa" className="font-semibold text-prelo-texto">
                  {s.all}
                </a>
                {faixas.map((f) => (
                  <a key={f.id} href={`#${f.id}`} className="text-ink hover:text-prelo-texto">
                    {f.nome}
                  </a>
                ))}
              </nav>
            )}
            <span>{lead ? fill(s.updated, { date: date.format(new Date(lead.date)) }) : s.free}</span>
          </div>
        </div>
      </section>
      <div className="mx-auto max-w-[78rem] px-4 sm:px-6 lg:px-8">
        <Untranslated lang={lang} t={t} show={articles.some((article) => !article.translated)} />
      </div>

      {/* ── Ainda sem matéria: o cartaz da estrela e dos raios ── */}
      {!lead && (
        <section className="pont border-b-[3px] border-ink">
          <div className="mx-auto grid max-w-[78rem] gap-8 px-4 py-12 sm:px-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:px-8">
            <div className="jornal-preto relative overflow-hidden border-2 border-ink p-7 shadow-[6px_6px_0_var(--prelo)] sm:p-10">
              <Star className="pointer-events-none absolute -top-8 -right-10 h-36 w-36 rotate-12 text-[#c21f16] md:top-auto md:-right-20 md:-bottom-32 md:h-80 md:w-80" />
              <p className="relative font-mono text-[0.7rem] uppercase tracking-[0.25em] text-[#e0837a]">{s.press}</p>
              <p className="relative mt-5 max-w-lg font-sans text-4xl font-black uppercase italic leading-[0.92] tracking-tight sm:text-6xl">{s.empty}</p>
              <p className="relative mt-6 max-w-md text-lg leading-snug text-[#f4ecd8]">{s.pressText}</p>
              <Link href={localePath(lang, "/voluntarios")} className="botao botao-prelo relative mt-7">
                {s.writeForUs} →
              </Link>
            </div>
            {giro}
          </div>
          <div className="mx-auto max-w-[78rem] px-4 pb-10 sm:px-6 lg:px-8">
            <EstadoVazio textos={t.lists.empty.jornal} acaoHref="/contribuir?tipo=sugestao" relacionadoHref="/noticias" />
          </div>
        </section>
      )}

      {/* ── A capa ── */}
      {lead && (
        <section id="capa" className="scroll-mt-40">
          <div className="mx-auto grid max-w-[78rem] gap-10 px-4 pt-9 pb-12 sm:px-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:px-8">
            <article {...originalLang(lead.translated)}>
              {chapeu(lead)}
              <h2 className="mt-2 font-serif text-[2.4rem] font-bold leading-[1.02] text-balance sm:text-[3.4rem]">
                <Link href={to(lead.slug)} className="text-ink hover:text-ink hover:underline hover:decoration-[#c21f16] hover:decoration-[3px]">
                  {lead.title}
                </Link>
              </h2>
              {lead.subtitle && <p className="mt-3 font-serif text-[1.35rem] leading-snug text-ink-soft">{lead.subtitle}</p>}
              {lead.image ? (
                <figure className="mt-6">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={lead.image} alt="" width={1200} height={700} decoding="async" className="aspect-[16/9] w-full border-2 border-ink object-cover shadow-[6px_6px_0_var(--sombra)]" />
                  <figcaption className="mt-2 font-mono text-[0.68rem] uppercase tracking-[0.08em] text-ink-soft">{lead.imageCredit}</figcaption>
                </figure>
              ) : null}
              <p className="jornal-texto jornal-capitular mt-6 border-t-2 border-ink pt-5 text-lg leading-relaxed sm:columns-2 sm:gap-8">{opening(lead)}</p>
              {assinatura(lead)}
              {!lead.image && <div className="mt-8">{giro}</div>}
            </article>
            <aside className="flex flex-col gap-6 lg:border-l-2 lg:border-ink lg:pl-8">
              {calls.map((a) => (
                <article key={a.slug} className="border-b-[1.5px] border-rule pb-5" {...originalLang(a.translated)}>
                  {chapeu(a)}
                  <h3 className="mt-1.5 font-serif text-[1.7rem] font-semibold leading-[1.1]">
                    <Link href={to(a.slug)} className="text-ink hover:text-ink hover:underline hover:decoration-[#c21f16] hover:decoration-2">
                      {a.title}
                    </Link>
                  </h3>
                  {assinatura(a)}
                </article>
              ))}
              {lead.image && giro}
              <MaisLidas recentes={rest.slice(2, 5).concat(calls).slice(0, 3).map(chamada)} todas={articles.map(chamada)} titulo={s.mostRead} tituloSemContagem={s.readNow} />
            </aside>
          </div>
        </section>
      )}

      {/* ── Uma faixa por editoria ── */}
      {(faixas.length > 0 || semEditoria.length > 0) && (
        <section className="pont border-y-[3px] border-ink">
          <div className="mx-auto flex max-w-[78rem] flex-col gap-12 px-4 py-11 sm:px-6 lg:px-8">
            {[...faixas, ...(semEditoria.length ? [{ nome: s.more, id: "mais-noticias", itens: semEditoria }] : [])].map((f, i) => (
              <div key={f.id} id={f.id} className="scroll-mt-40">
                <h2 className="flex items-center gap-3.5">
                  <span className={`px-3 py-1.5 font-mono text-xs font-semibold uppercase tracking-[0.2em] ${i % 2 === 0 ? "bg-[#c21f16] text-white" : "bg-ink text-parchment"}`}>★ {f.nome}</span>
                  <span aria-hidden className={`flex-1 border-t-2 ${i % 2 === 0 ? "border-[#c21f16]" : "border-ink"}`} />
                </h2>
                <ul className="mt-6 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
                  {f.itens.map((a, j) => (
                    <li key={a.slug} className={`${j % 3 === 1 ? "cartao-v" : "cartao"} flex flex-col overflow-hidden`} {...originalLang(a.translated)}>
                      {a.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.image} alt="" width={600} height={300} loading="lazy" decoding="async" className="aspect-[2/1] w-full border-b-2 border-ink object-cover" />
                      ) : (
                        // Sem foto: a faixa listrada com a estrela, como o papel de embrulho dos cartazes.
                        <span aria-hidden className="jornal-sem-foto flex aspect-[3/1] items-center justify-center border-b-2 border-ink">
                          <Star className="h-9 w-9 text-[#c21f16]" />
                        </span>
                      )}
                      <div className="flex flex-1 flex-col p-5">
                      {chapeu(a)}
                      <h3 className="mt-1.5 font-serif text-[1.45rem] font-semibold leading-[1.15]">
                        <Link href={to(a.slug)} className="text-ink hover:text-ink hover:underline hover:decoration-[#c21f16] hover:decoration-2">
                          {a.title}
                        </Link>
                      </h3>
                      {a.subtitle && <p className="mt-2 line-clamp-3 leading-snug text-ink-soft">{a.subtitle}</p>}
                      <div className="mt-auto">{assinatura(a)}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {lead && (
        <p className="mx-auto flex max-w-[78rem] flex-wrap items-center justify-between gap-4 px-4 py-8 sm:px-6 lg:px-8">
          <span className="max-w-2xl font-serif text-xl leading-snug text-ink-soft">{s.lead}</span>
          <Link href={localePath(lang, "/voluntarios")} className="botao botao-tinta">
            {s.writeForUs} →
          </Link>
        </p>
      )}

      <Newsletter s={s.newsletter} faixa />
    </>
  );
}
