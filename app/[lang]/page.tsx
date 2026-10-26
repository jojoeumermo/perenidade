// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "@/components/Link";
import { DailyQuote } from "@/components/DailyQuote";
import { NesteDia } from "@/components/NesteDia";
import { Star } from "@/components/Masthead";
import { Experimente, type Sugestao } from "@/components/inicio/Experimente";
import { LambeDoDia } from "@/components/inicio/LambeDoDia";
import { AulaDaSemana } from "@/components/inicio/AulaDaSemana";
import { aulasDaSemana } from "@/lib/aula-da-semana";
import { lambesDaSemana } from "@/lib/lambes";
import { JanelaContinue, JanelaNoAr } from "@/components/inicio/Janelas";
import { type EstanteDoApp, InicioDoApp } from "@/components/inicio/InicioDoApp";
import { FaixaDaSaude } from "@/components/saude/FaixaDaSaude";
import { territorios } from "@/lib/territorios";
import { loadLang } from "@/i18n";
import { fill, htmlLang, localePath } from "@/i18n/config";
import { essential, groups, type Stage, stages } from "@/lib/areas";
import { getArticles, getBooks, getCatalog, getQuestions, getQuotes, getTracks } from "@/lib/content";
import { describePart, overview, publicHistory } from "@/lib/history";
import { alternatesDe } from "@/lib/seo";
import { site } from "@/lib/site";
import { DisciplineBrowser, type DisciplineGroup } from "@/components/DisciplineBrowser";

// A página inicial herda título e descrição do layout; aqui entram o endereço canônico e as versões em cada idioma.
export async function generateMetadata({ params }: PageProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  return { alternates: alternatesDe(lang, "") };
}

const numero = (lang: string, n: number) => new Intl.NumberFormat(lang).format(n);

/**
 * A inicial no desenho do Caderno do Povo: o lambe-lambe e a busca no papel pontilhado, o Mural de Saúde logo
 * abaixo, as três janelas (onde parou, o jornal, o que está no ar), as estantes de cadernos e, no fim, a frase
 * do dia, os fatos de luta da data, as perguntas e a dedicatória.
 */
export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang, t } = await loadLang(params);
  const h = t.home;
  const to = (path: string) => localePath(lang, path);
  const tracks = getTracks(lang);
  const books = getBooks(lang);
  const articles = getArticles(lang).slice(0, 3);
  const lessons = tracks.reduce((sum, track) => sum + track.lessons.length, 0);
  const areas = groups.flatMap((group) => group.areas).length;
  const works = books.length + groups.flatMap((group) => group.areas).reduce((sum, area) => sum + getCatalog(area).length, 0);
  const recent = publicHistory(site.historyFrom, lang)
    .slice(0, 3)
    .map((change) => ({ date: change.date, parts: overview(change.parts) }));
  const date = new Intl.DateTimeFormat(htmlLang[lang], { timeZone: "UTC" });
  const dataCurta = new Intl.DateTimeFormat(htmlLang[lang], { day: "numeric", month: "short", timeZone: "UTC" });
  const shelves: DisciplineGroup[] = groups.map((group) => ({
    id: group.id,
    title: t.groups[group.id],
    areas: group.areas.map((slug) => {
      const counts = Object.fromEntries(stages.map((stage) => [stage, [0, 0]])) as Record<Stage, [number, number]>;
      for (const track of tracks) {
        if (track.area !== slug) continue;
        counts[track.stage][0] += track.lessons.length;
        counts[track.stage][1] += track.plan.length;
      }
      const palavras = tracks.filter((track) => track.area === slug).map((track) => track.title).join(" ");
      return { slug, name: t.areas[slug][0], description: t.areas[slug][1], essential: essential.includes(slug), counts, palavras };
    }),
  }));
  const [, pontuacao = "", resto = h.h1c] = /^([,，、;:.!?]*)([\s\S]*)$/.exec(h.h1c) ?? [];
  const started = tracks.filter((track) => track.lessons.length > 0).sort((a, b) => b.lessons.length - a.lessons.length);
  const questions = getQuestions().slice(0, 4);
  // As portas do "Experimente": as trilhas com aula pronta e algumas seções que pegam quem chega curioso.
  const sugestoes: Sugestao[] = [
    { label: t.nav.start, path: "/comecar" },
    ...started.slice(0, 24).map((track) => ({ label: track.title, path: `/trilhas/${track.slug}` })),
    { label: t.nav.labs, path: "/laboratorios" },
    { label: t.nav.data, path: "/dados" },
    { label: t.nav.questionBank, path: "/questoes" },
    { label: t.nav.timeline, path: "/linha-do-tempo" },
    { label: t.nav.glossary, path: "/glossario" },
    { label: t.nav.factCheck, path: "/checagens" },
    { label: t.nav.memorial, path: "/memorial" },
    { label: t.nav.tools, path: "/ferramentas" },
  ];

  // As estantes da fileira do aplicativo: as que já têm aula, as mais cheias primeiro.
  const aulasPorEstante = new Map<string, number>();
  for (const track of tracks) aulasPorEstante.set(track.area, (aulasPorEstante.get(track.area) ?? 0) + track.lessons.length);
  const estantesDoApp: EstanteDoApp[] = groups
    .flatMap((group) => group.areas.map((slug) => ({ slug, grupo: t.groups[group.id], n: aulasPorEstante.get(slug) ?? 0 })))
    .filter((estante) => estante.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 12)
    .map((estante) => ({ slug: estante.slug, nome: t.areas[estante.slug][0], etapa: estante.grupo, aulas: `${numero(lang, estante.n)} ${estante.n === 1 ? t.common.lessons.one : t.common.lessons.other}` }));

  return (
    <>
      <InicioDoApp
        busca={to("/busca")}
        estantes={estantesDoApp}
        textos={{
          busca: h.searchPlaceholder,
          buscaRotulo: h.searchLabel,
          buscar: h.searchButton,
          continuar: t.tracks.continue,
          retomar: t.tracks.resume,
          comecar: t.nav.start,
          comecarTexto: h.startText,
          estantes: h.shelvesPick,
          verTodas: fill(h.seeAllShelves, { n: areas }),
        }}
      />
      {/* ── O alto: busca e lambe-lambe no papel pontilhado ── */}
      {/* No aplicativo, o começo é o InicioDoApp acima: o lambe-lambe grande fica para o site. */}
      <section className="pont border-b-[3px] border-ink app:max-md:hidden">
        <div className="mx-auto grid max-w-[78rem] items-center gap-12 px-4 pt-14 pb-16 sm:px-6 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-14 lg:px-8 lg:pt-[4.5rem] lg:pb-20 max-md:pt-7 max-md:pb-9">
          <div className="min-w-0">
            <p className="rotulo">{h.kicker}</p>
            <h1 className="mt-4 text-[2.9rem] font-medium leading-[0.98] tracking-[-0.01em] text-balance sm:text-6xl lg:text-[4.9rem]">
              {h.h1a}{" "}
              {/* A vírgula logo depois de "para todos" fica grudada nele: nunca começa uma linha sozinha. */}
              <span className="whitespace-nowrap">
                <span className="relative inline-block italic text-prelo-texto">
                  {h.h1b}
                  <svg viewBox="0 0 300 18" preserveAspectRatio="none" aria-hidden className="absolute inset-x-0 -bottom-1.5 h-3.5 w-full">
                    <path d="M3 12 C 60 4, 140 4, 297 9" stroke="currentColor" strokeWidth="5" fill="none" strokeLinecap="round" />
                  </svg>
                </span>
                {pontuacao}
              </span>
              {resto}
            </h1>
            <p className="mt-7 max-w-[35rem] text-[1.35rem] leading-[1.45] text-ink-soft max-md:mt-4 max-md:text-lg">{h.lead}</p>
            <form action={to("/busca")} role="search" className="mt-9 flex max-w-[39rem] shadow-[6px_6px_0_var(--sombra)] max-md:mt-6">
              <input
                name="q"
                type="search"
                aria-label={h.searchLabel}
                placeholder={h.searchPlaceholder}
                className="min-w-0 flex-1 border-2 border-r-0 border-ink bg-folha px-4 py-4 font-sans text-base text-ink outline-none placeholder:text-ink-soft sm:px-5 sm:py-[1.1rem] sm:text-[1.05rem]"
              />
              <button className="cursor-pointer border-2 border-ink bg-[#c21f16] px-6 font-sans text-base font-extrabold text-white hover:bg-[#a51810] sm:px-7">{h.searchButton}</button>
            </form>
            <p className="mt-3 max-w-[39rem] font-sans text-sm text-ink-soft">{h.searchHint}</p>
            <Experimente rotulo={h.tryLabel} sugestoes={sugestoes} />
          </div>

          {/* O lambe-lambe colado torto, com os números do acervo e o carimbo. */}
          <div className="relative px-2 pt-4 pb-8 max-md:hidden">
            <div className="cartao-preto -rotate-2 px-9 pt-10 pb-8">
              <LambeDoDia dias={lambesDaSemana(lang)} rotulo={h.posterLabel} />
              <dl className="mt-7 grid grid-cols-3 border-t-[1.5px] border-[#5a4e3c] pt-5">
                {[
                  [numero(lang, areas), t.common.disciplines.other.replace("{n}", "").trim()],
                  [numero(lang, lessons), t.common.lessons.other.replace("{n}", "").trim()],
                  [numero(lang, works), t.common.works.other.replace("{n}", "").trim()],
                ].map(([valor, nome]) => (
                  <div key={nome}>
                    <dt className="sr-only">{nome}</dt>
                    <dd className="text-[2.35rem] font-semibold leading-none text-[#f4ecd8]">{valor}</dd>
                    <dd aria-hidden className="mt-1.5 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-[#b3a584]">{nome}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div aria-hidden className="carimbo absolute -top-4 -right-3 z-10 h-28 w-28 rotate-[14deg] bg-[color-mix(in_srgb,var(--parchment)_94%,transparent)] text-[0.66rem]">
              <span>
                {h.stamp[0]}
                <br />
                {h.stamp[1]}
                <br />
                {h.stamp[2]}
                <br />
                {h.stamp[3]}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Mural de Saúde, entre a busca e as janelas: cartão neutro, sem nenhum nome ── */}
      <FaixaDaSaude href={to("/saude")} />

      {/* ── Mais do que aulas: o instituto forma gente para a luta, e o Despertar é a porta de entrada ── */}
      <section className="capa-preta relative overflow-hidden border-y-4 border-[#c21f16] bg-[#1f1a14] text-[#f4ecd8]">
        <Star className="pointer-events-none absolute -right-14 -bottom-20 h-72 w-72 rotate-12 text-[#c21f16] max-md:h-44 max-md:w-44" />
        <div className="relative mx-auto grid max-w-[78rem] items-center gap-8 px-4 py-14 sm:px-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:px-8 max-md:py-10">
          <div className="min-w-0">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#e0837a]">{h.moreKicker}</p>
            <h2 className="mt-3 text-[2.5rem] font-medium leading-[1.02] text-balance sm:text-[3.2rem]">{h.moreTitle}</h2>
            <p className="mt-4 max-w-[40rem] text-[1.2rem] leading-relaxed text-[#e9dcbc]">{h.moreText}</p>
          </div>
          <div className="flex flex-col items-start gap-4 md:items-end">
            <Link href={to("/despertar")} className="botao botao-prelo text-lg">{h.moreStart} →</Link>
            <Link href={to("/sobre")} className="font-sans font-bold text-[#f4ecd8] underline decoration-[#c21f16] decoration-2 underline-offset-4 hover:text-white">{h.moreManifesto}</Link>
          </div>
        </div>
      </section>

      {/* ── As três janelas ── */}
      <section>
        <div className="mx-auto grid max-w-[78rem] gap-8 px-4 py-14 sm:px-6 md:grid-cols-3 lg:px-8 max-md:py-8">
          <JanelaContinue textos={{ continuar: t.tracks.continue, retomar: t.tracks.resume, comecar: t.nav.start, comecarTexto: h.startText }} />

          {articles.length > 0 ? (
            <article className="cartao p-6">
              <p className="rotulo">{h.journalWindow}</p>
              <ul className="mt-3 flex flex-col">
                {articles.map((article) => (
                  <li key={article.slug} className="border-b-[1.5px] border-dashed border-rule py-3.5 last:border-b-0">
                    <Link href={to(`/jornal/${article.slug}`)} className="text-[1.3rem] leading-tight text-ink hover:text-ink hover:underline hover:decoration-[#c21f16] hover:decoration-2">
                      {article.title}
                    </Link>
                    <p className="mt-1.5 font-mono text-[0.68rem] uppercase tracking-[0.1em] text-ink-soft">
                      {article.section ? `${article.section} · ` : ""}
                      {dataCurta.format(new Date(article.date))}
                    </p>
                  </li>
                ))}
              </ul>
            </article>
          ) : (
            // Sem matéria ainda: o cartaz do jornal (preto com a estrela) e o sol de raios do giro de notícias.
            <article className="flex flex-col overflow-hidden border-2 border-[#1f1a14] shadow-[6px_6px_0_var(--sombra)]">
              <Link href={to("/jornal")} className="jornal-preto relative block flex-1 overflow-hidden p-6 text-[#f4ecd8] hover:text-white">
                <Star className="pointer-events-none absolute -right-8 -bottom-10 h-36 w-36 rotate-12 text-[#c21f16]" />
                <span className="relative block font-mono text-[0.68rem] uppercase tracking-[0.22em] text-[#d4a24c]">{t.journal.nameTop} {t.journal.nameBottom}</span>
                <span className="lambe relative mt-3 block max-w-[15rem] text-[2rem]">{t.journal.empty}</span>
              </Link>
              <Link href={to("/noticias")} className="jornal-raios block p-5 font-sans text-white hover:text-white">
                <span className="lambe block text-[1.35rem]">{t.journal.newsletter.roundTitle}</span>
                <span className="mt-2 inline-block bg-white px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide text-[#a51810]">{t.journal.newsletter.roundButton} →</span>
              </Link>
            </article>
          )}

          <JanelaNoAr textos={{ noAr: h.onAir, ouvir: h.listen, todos: h.allEpisodes, radio: t.nav.radio, radioTexto: h.radioLive }} />
        </div>
      </section>

      {/* ── As estantes ── */}
      <section className="pont border-y-[3px] border-ink">
        <div className="mx-auto max-w-[78rem] px-4 pt-16 pb-[4.5rem] sm:px-6 lg:px-8 max-md:pt-9 max-md:pb-10">
          <p className="rotulo">{h.shelvesKicker}</p>
          <h2 className="mt-2 text-[2.6rem] font-medium leading-none sm:text-[3.5rem]">{h.shelvesPick}</h2>
          <p className="mt-3 max-w-2xl text-xl text-ink-soft">{h.shelvesHint}</p>
          <DisciplineBrowser labels groups={shelves} s={t.tracks} stageNames={t.stages} />
          <p className="mt-12 flex flex-wrap items-center gap-5">
            <Link href={to("/trilhas")} className="botao botao-tinta text-[1.05rem]">
              {fill(h.seeAllShelves, { n: areas })} →
            </Link>
            <Link href={to("/comecar")} className="font-sans font-bold text-ink underline decoration-[#c21f16] decoration-2 underline-offset-4 hover:text-prelo-texto">
              {t.nav.start}
            </Link>
          </p>
        </div>
      </section>

      <AulaDaSemana semanas={aulasDaSemana(lang)} lang={lang} url={site.url} s={t.aulaDaSemana} sc={t.compartilhar} area={Object.fromEntries(Object.entries(t.areas).map(([k, v]) => [k, v[0]]))} />

      {/* ── Territórios: o coletivo parceiro mais recente, com a faixa dos temas ── */}
      {territorios.length > 0 && (() => {
        const territorio = territorios[territorios.length - 1];
        return (
          <section className="border-b-[3px] border-ink">
            <div className="mx-auto flex max-w-[78rem] flex-wrap items-center justify-between gap-x-10 gap-y-5 px-4 py-10 sm:px-6 lg:px-8">
              <div className="min-w-0">
                <p className="font-mono text-xs uppercase tracking-[0.22em] text-prelo-texto">{t.territorios.partner.replace("{n}", String(territorio.numero).padStart(2, "0"))}</p>
                <h2 className="mt-2 font-serif text-[2.4rem] font-semibold leading-none sm:text-[3rem]">{territorio.nome} <span className="text-prelo-texto">×</span> Lúcia</h2>
                <p className="mt-3 max-w-2xl text-lg text-ink-soft">{territorio.linha} {territorio.temas[0]}.</p>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <Link href={to(`/territorios/${territorio.slug}`)} className="botao botao-tinta">{t.territorios.open} →</Link>
                <Link href={to("/territorios")} className="font-sans font-bold text-ink underline decoration-[#c21f16] decoration-2 underline-offset-4 hover:text-prelo-texto">{t.territorios.title}</Link>
              </div>
            </div>
          </section>
        );
      })()}

      <DailyQuote quotes={getQuotes()} />

      <NesteDia s={h} lang={lang} />

      {questions.length > 0 && (
        <section className="mx-auto max-w-[78rem] px-4 py-12 sm:px-6 lg:px-8">
          <h2 className="tarja">
            <span className="tarja-nome">{h.questionsTitle}</span>
          </h2>
          <ul className="mt-7 grid gap-5 font-sans sm:grid-cols-2" lang="pt-BR">
            {questions.map((question, i) => (
              <li key={question.pergunta}>
                <Link href={`${to("/perguntas")}#p${i + 1}`} className="cartao sobe flex h-full items-start gap-4 p-5 text-lg font-semibold leading-snug text-ink hover:text-ink">
                  <span aria-hidden className="font-serif text-3xl leading-none font-semibold text-prelo-texto">?</span>
                  {question.pergunta}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-6">
            <Link href={to("/perguntas")} className="font-sans text-sm font-bold underline decoration-[#c21f16] underline-offset-4 hover:text-prelo-texto">{h.seeAll} →</Link>
          </p>
        </section>
      )}

      <section className="mx-auto max-w-[78rem] px-4 py-12 sm:px-6 lg:px-8">
        <h2 className="tarja tarja-v">
          <span className="tarja-nome">★ {h.wingsTitle}</span>
        </h2>
        <div className="mt-7 grid gap-7 md:grid-cols-3">
          {h.wings.map(([title, description, path], i) => (
            <Link key={path} href={to(path)} className={`sobe flex flex-col p-6 text-ink hover:text-ink ${i === 1 ? "cartao-v" : "cartao"}`}>
              <h3 className="text-[1.65rem] font-semibold leading-tight">{title}</h3>
              <p className="mt-2 text-lg leading-snug text-ink-soft">{description}</p>
              <span className="mt-auto pt-4 font-sans text-sm font-bold">→</span>
            </Link>
          ))}
        </div>
      </section>

      {recent.length > 0 && (
        <section className="mx-auto max-w-[78rem] px-4 py-12 sm:px-6 lg:px-8">
          <div className="cartao p-7 sm:p-9">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-3xl font-semibold">{h.timelineTitle}</h2>
              <Link href={to("/historico")} className="font-sans text-sm font-bold underline decoration-[#c21f16] underline-offset-4 hover:text-prelo-texto">{h.fullHistory}</Link>
            </div>
            <p className="mt-1 font-mono text-xs text-ink-soft">{h.timelineSub}</p>
            <ol className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-start">
              {recent.map((change) => (
                <li key={change.date} className="flex-1 border-t-[3px] border-ink pt-3">
                  <p className="font-mono text-sm text-prelo-texto">
                    <time dateTime={change.date}>{date.format(new Date(change.date))}</time>
                  </p>
                  {/* Só as três primeiras linhas do resumo do dia; o resto está no histórico completo. */}
                  <p className="text-lg">
                    {change.parts.slice(0, 3).map((part) => describePart(part, lang, t)).join(" · ")}
                    {change.parts.length > 3 && ` · ${fill(t.history.more, { n: change.parts.length - 3 })}`}
                  </p>
                </li>
              ))}
              <li className="flex-1 border-t-[3px] border-dashed border-ink pt-3">
                <p className="font-mono text-sm text-prelo-texto">{h.soon}</p>
                <p className="text-lg">
                  <Link href={to("/contribuir")} className="underline hover:text-prelo-texto">{h.yourContribution}</Link>
                </p>
              </li>
            </ol>
          </div>
        </section>
      )}

      <section className="mx-auto grid max-w-[78rem] gap-8 px-4 py-10 font-sans sm:px-6 md:grid-cols-3 lg:px-8">
        {h.pillars.map(([title, description]) => (
          <div key={title} className="border-t-4 border-[#c21f16] pt-4">
            <h3 className="text-base font-bold">{title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{description}</p>
          </div>
        ))}
      </section>

      {/* ── O chamado para construir junto, na faixa vermelha ── */}
      <section className="mt-6 border-y-[3px] border-ink bg-[#c21f16] text-white">
        <div className="mx-auto flex max-w-[78rem] flex-wrap items-center justify-between gap-6 px-4 py-12 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="lambe text-4xl sm:text-5xl">{h.ctaTitle}</h2>
            <p className="mt-3 text-xl leading-snug text-[#fde8e4]">{h.ctaText}</p>
          </div>
          <Link href={to("/contribuir")} className="botao border-[#1f1a14] bg-[#1f1a14] text-[#f4ecd8] hover:text-white">
            {h.ctaButton} →
          </Link>
        </div>
      </section>

      {/* ── A dedicatória ── */}
      <section className="bg-[#1f1a14] text-[#f4ecd8]">
        <div className="mx-auto max-w-[78rem] px-4 py-16 text-center sm:px-6 lg:px-8">
          <p aria-hidden className="text-2xl tracking-[0.5em] text-[#c21f16]">★ ★ ★</p>
          <p className="mx-auto mt-5 max-w-3xl text-4xl italic leading-tight sm:text-5xl">“{h.dedicationQuote}”</p>
          <Link href={to("/dedicatoria")} className="mt-6 inline-block font-mono text-sm uppercase tracking-[0.24em] text-[#e0837a] hover:text-white">
            {h.dedicationLink} →
          </Link>
        </div>
      </section>
    </>
  );
}
