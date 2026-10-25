// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CapaDaEdicao } from "@/components/Territorios";
import { originalLang, Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { getArticles, getTracks } from "@/lib/content";
import { withLangs } from "@/lib/params";
import { paginaMeta } from "@/lib/seo";
import { site } from "@/lib/site";
import { territorios } from "@/lib/territorios";

export const dynamicParams = false;

export function generateStaticParams() {
  return withLangs(territorios.map((territorio) => ({ slug: territorio.slug })));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/territorios/[slug]">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  const { slug } = await params;
  const territorio = territorios.find((item) => item.slug === slug);
  return territorio ? paginaMeta(lang, `/territorios/${territorio.slug}`, `${territorio.nome} · ${t.territorios.title}`, territorio.linha, { titulo: territorio.nome, subtitulo: territorio.linha, kicker: t.territorios.title }) : {};
}

/**
 * A página de um território parceiro: quem faz, as edições (capas de revista), a editoria dele no jornal, as trilhas que
 * ele ensina, a cápsula de roupas feita junto e o convite para outros coletivos. Os textos estão em content/territorios.json.
 */
export default async function TerritorioPage({ params }: PageProps<"/[lang]/territorios/[slug]">) {
  const { lang, t } = await loadLang(params);
  const { slug } = await params;
  const territorio = territorios.find((item) => item.slug === slug);
  if (!territorio) notFound();
  const s = t.territorios;
  const to = (path: string) => localePath(lang, path);
  const areas = t.areas as Record<string, string[]>;

  const materias = getArticles(lang).filter((artigo) => artigo.section === territorio.editoria).slice(0, 3);
  const trilhas = new Map(getTracks(lang).map((track) => [track.slug, track]));
  const daqui = territorio.trilhas.map((id) => trilhas.get(id)).filter((track) => track !== undefined);
  const faixa = Array.from({ length: 4 }, () => territorio.temas).flat();

  return (
    <div {...originalLang(lang === "pt")}>
      <section className="border-b-2 border-ink">
        <div className="mx-auto grid max-w-[78rem] items-center gap-10 px-4 py-12 sm:px-6 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:px-8">
          <div className="min-w-0">
            <nav aria-label={s.title} className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-ink-soft">
              <Link href={to("/territorios")} className="hover:text-prelo-texto">{s.title}</Link> › {territorio.nome}
            </nav>
            <p className="mt-6 font-mono text-[0.7rem] uppercase tracking-[0.2em] text-prelo-texto">{s.partner.replace("{n}", String(territorio.numero).padStart(2, "0"))}</p>
            <h1 className="mt-2 font-serif text-[4rem] font-semibold leading-[0.9] tracking-[-0.02em] sm:text-[6rem]">{territorio.nome}</h1>
            <p className="mt-5 text-xl font-semibold">{territorio.linha}</p>
            <p className="mt-3 max-w-2xl text-lg leading-relaxed text-ink-soft">{territorio.sobre}</p>
            <p className="mt-3 max-w-2xl leading-relaxed">{territorio.quem}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href={`https://www.instagram.com/${territorio.instagram}/`} className="botao botao-prelo" rel="noopener noreferrer" target="_blank">
                {s.follow} @{territorio.instagram}
              </a>
              {territorio.pessoas.map((pessoa) => (
                <a key={pessoa.instagram} href={`https://www.instagram.com/${pessoa.instagram}/`} className="botao botao-papel" rel="noopener noreferrer" target="_blank">
                  {pessoa.nome.split(" ")[0]} · @{pessoa.instagram}
                </a>
              ))}
            </div>
            <Untranslated lang={lang} t={t} show={lang !== "pt"} />
          </div>
          {territorio.edicoes[0] && (
            <div className="mx-auto w-full max-w-[22rem] rotate-1">
              <CapaDaEdicao edicao={territorio.edicoes[0]} perfil={territorio.instagram} assinatura={s.byCollective} grande />
            </div>
          )}
        </div>
      </section>

      {/* A faixa dos temas, como as tarjas de evento. */}
      <div aria-hidden className="overflow-hidden whitespace-nowrap border-b-2 border-ink bg-[#1f1a14] py-3 font-mono text-sm font-semibold uppercase tracking-[0.2em] text-[#f4ecd8]">
        {faixa.map((tema, i) => (
          <span key={i} className="mx-4">
            {tema} <span className="ml-4 text-[#e0837a]">✦</span>
          </span>
        ))}
      </div>

      <div className="mx-auto max-w-[78rem] px-4 sm:px-6 lg:px-8">
        <section className="py-14">
          <p className="rotulo">{s.editions}</p>
          <h2 className="mt-2 font-serif text-[2.4rem] font-semibold leading-tight">{s.editionsTitle}</h2>
          <ul className="mt-8 grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-5">
            {territorio.edicoes.map((edicao) => (
              <li key={edicao.titulo}>
                <CapaDaEdicao edicao={edicao} perfil={territorio.instagram} assinatura={s.byCollective} />
              </li>
            ))}
          </ul>
        </section>

        <section className="grid gap-8 border-t-2 border-ink py-14 md:grid-cols-[18rem_minmax(0,1fr)]">
          <div>
            <p className="rotulo">{s.journalKicker}</p>
            <h2 className="mt-2 font-serif text-[2rem] font-semibold leading-tight">{s.journalTitle.replace("{editoria}", territorio.editoria)}</h2>
            <Link href={to("/jornal")} className="mt-4 inline-block font-sans font-semibold text-prelo-texto hover:underline">{s.journalAll} →</Link>
          </div>
          {materias.length > 0 ? (
            <ul className="grid gap-5 sm:grid-cols-3">
              {materias.map((materia) => (
                <li key={materia.slug} className="border-t-4 border-ink pt-3">
                  <p className="font-mono text-[0.66rem] uppercase tracking-[0.2em] text-prelo-texto">{materia.author}</p>
                  <Link href={to(`/jornal/${materia.slug}`)} className="mt-1 block font-serif text-xl font-semibold leading-snug hover:text-prelo-texto">{materia.title}</Link>
                  {materia.subtitle && <p className="mt-1 text-sm text-ink-soft">{materia.subtitle}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <div>
              <p className="text-ink-soft">{s.journalEmpty}</p>
              <ul className="mt-4 grid gap-4 sm:grid-cols-3">
                {territorio.pautas.map((pauta) => (
                  <li key={pauta} className="border-l-4 border-dashed border-ink-soft pl-3 font-serif text-lg leading-snug">{pauta}</li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {daqui.length > 0 && (
          <section className="border-t-2 border-ink py-14">
            <p className="rotulo">{s.learnKicker}</p>
            <h2 className="mt-2 font-serif text-[2.4rem] font-semibold leading-tight">{s.learnTitle}</h2>
            <ul className="mt-8 grid gap-6 md:grid-cols-3">
              {daqui.map((track) => (
                <li key={track.slug}>
                  <Link href={to(`/trilhas/${track.slug}`)} className="flex h-full flex-col border-2 border-ink bg-folha p-5 shadow-[5px_5px_0_var(--sombra)] hover:shadow-[5px_5px_0_var(--prelo-texto)]">
                    <span className="font-mono text-[0.66rem] uppercase tracking-[0.18em] text-ink-soft">
                      {areas[track.area]?.[0] ?? track.area} · {s.lessons.replace("{n}", String(track.lessons.length + track.plan.filter((p) => !p.ready).length))}
                    </span>
                    <span className="mt-2 font-serif text-[1.45rem] font-semibold leading-tight">{track.title}</span>
                    <span className="mt-2 text-sm leading-relaxed text-ink-soft">{track.summary}</span>
                    {track.lessons.length === 0 && (
                      <span className="mt-4 self-start border border-dashed border-ink-soft px-1.5 py-0.5 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-ink-soft">{s.soon}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {territorio.capsula && (
        <section className="capa-preta border-y-4 border-[#c21f16] bg-[#1f1a14] text-[#f4ecd8]">
          <div className="mx-auto grid max-w-[78rem] items-center gap-10 px-4 py-14 sm:px-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:px-8">
            <div className="min-w-0">
              <p className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-[#e0837a]">{s.capsuleKicker}</p>
              <h2 className="lambe mt-3 text-[3.6rem] leading-[0.9] sm:text-[4.6rem]">{territorio.capsula.nome}</h2>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-[#e9dcbc]">{territorio.capsula.texto}</p>
            </div>
            <ul className="grid grid-cols-3 gap-4">
              {territorio.capsula.pecas.map((peca, i) => (
                <li key={peca} className="flex aspect-[3/4] max-w-full flex-col justify-between border-2 border-[#f4ecd8] p-3">
                  <span className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-[#b3a584]">Look {String(i + 1).padStart(2, "0")}</span>
                  <span className="font-serif text-lg font-semibold leading-tight sm:text-xl">{peca}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <div className="mx-auto max-w-[78rem] px-4 sm:px-6 lg:px-8">
        <section className="py-14">
          <p className="rotulo">{s.people}</p>
          <ul className="mt-4 flex flex-wrap gap-6">
            {territorio.pessoas.map((pessoa) => (
              <li key={pessoa.nome} className="border-l-4 border-ink pl-4">
                <p className="font-serif text-2xl font-semibold">{pessoa.nome}</p>
                <p className="text-ink-soft">{pessoa.papel}</p>
                <a href={`https://www.instagram.com/${pessoa.instagram}/`} className="font-mono text-sm font-semibold hover:text-prelo-texto" rel="noopener noreferrer" target="_blank">@{pessoa.instagram}</a>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-16 border-2 border-dashed border-ink p-6 sm:p-8">
          <h2 className="max-w-3xl font-serif text-[1.8rem] font-semibold leading-tight text-balance">{s.nextTitle}</h2>
          <p className="mt-3 max-w-2xl text-ink-soft">{s.nextText}</p>
          <p className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
            <a href={`mailto:${site.newsletter}?subject=${encodeURIComponent(s.nextCta)}`} className="botao botao-papel">{s.nextCta}</a>
            <span className="font-mono text-sm select-all">{site.newsletter}</span>
            <Link href={to("/territorios")} className="font-sans font-semibold hover:text-prelo-texto">{s.all} →</Link>
          </p>
        </section>
      </div>
    </div>
  );
}
