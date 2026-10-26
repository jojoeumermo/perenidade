// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Image from "next/image";
import Link from "@/components/Link";
import { notFound } from "next/navigation";
import { CapaDaEdicao, Letreiro, MarcaNaAtividade } from "@/components/Territorios";
import { originalLang, Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { getArticles, getTracks } from "@/lib/content";
import { caligrafia, playfair } from "@/lib/fontes-territorio";
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

const tag = "font-mono text-[0.66rem] uppercase tracking-[0.2em]";
const botao = "inline-flex items-center gap-2 border-2 px-5 py-3 font-sans font-extrabold no-underline";

/**
 * A página de um território parceiro, no desenho do Territorio do canvas: a abertura preta com a marca, a linha e a foto
 * de capa; o letreiro dos temas; as edições (as capas de verdade); a editoria no jornal; as trilhas; a cápsula; o
 * podcast e o lançamento; e o convite para outros coletivos. Os textos estão em content/territorios.json.
 */
export default async function TerritorioPage({ params }: PageProps<"/[lang]/territorios/[slug]">) {
  const { lang, t } = await loadLang(params);
  const { slug } = await params;
  const territorio = territorios.find((item) => item.slug === slug);
  if (!territorio) notFound();
  const s = t.territorios;
  const to = (path: string) => localePath(lang, path);
  const areas = t.areas as Record<string, string[]>;
  const instagram = `https://www.instagram.com/${territorio.instagram}/`;

  const materias = getArticles(lang).filter((artigo) => artigo.section === territorio.editoria).slice(0, 3);
  const trilhas = new Map(getTracks(lang).map((track) => [track.slug, track]));
  const daqui = territorio.trilhas.map((id) => trilhas.get(id)).filter((track) => track !== undefined);
  const [principal, ...outros] = territorio.destaques ?? [];

  return (
    <div className={`${playfair.variable} ${caligrafia.variable}`} {...originalLang(lang === "pt")}>
      {/* A trilha de onde a pessoa está, na tarja escura do desenho. */}
      <nav aria-label={s.title} className="border-b-[3px] border-[#c21f16] bg-[#1f1a14] text-[#b3a584]">
        <p className={`mx-auto max-w-[78rem] px-4 py-3 sm:px-8 ${tag}`}>
          <Link href={to("/territorios")} className="text-[#b3a584] hover:text-white">{s.title}</Link> › <span className="text-[#f4ecd8]">{territorio.nome}</span>
        </p>
      </nav>

      {/* A abertura: preta, com a marca e o nome em letra de revista, e as capas à direita. */}
      <section className="bg-[#0f0d0b] text-[#f4ecd8]">
        <div className="mx-auto grid max-w-[78rem] items-center gap-12 px-4 py-14 sm:px-8 md:grid-cols-2">
          <div className="min-w-0">
            <p className={`${tag} text-[#e0837a]`}>{s.partner.replace("{n}", String(territorio.numero).padStart(2, "0"))}</p>
            <div className="mt-5 flex items-center gap-5">
              {territorio.slug === "na-atividade" && <MarcaNaAtividade className="h-[54px] w-auto shrink-0" />}
              <h1 className="territorio-play text-[3.4rem] font-black leading-[0.95] tracking-[-0.02em] sm:text-[4rem]">{territorio.nome}</h1>
            </div>
            <p className="territorio-play mt-6 text-[1.6rem] font-semibold leading-[1.25]">{territorio.linha} {territorio.sobre.split(". ")[0]}.</p>
            <p className="mt-4 max-w-[33rem] font-sans text-[0.95rem] leading-relaxed text-[#cdbb91]">{territorio.quem}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href={instagram} className={`${botao} border-[#e01b22] bg-[#e01b22] text-white hover:text-white`} rel="noopener noreferrer" target="_blank">
                {s.follow} @{territorio.instagram}
              </a>
              {territorio.pessoas.map((pessoa) => (
                <a key={pessoa.instagram} href={`https://www.instagram.com/${pessoa.instagram}/`} className={`${botao} border-[#f4ecd8] text-[#f4ecd8] hover:text-[#f0cf8e]`} rel="noopener noreferrer" target="_blank">
                  {pessoa.nome.split(" ")[0]} · @{pessoa.instagram}
                </a>
              ))}
            </div>
            {territorio.imprensa && (
              <p className="mt-6 font-sans text-[0.82rem] text-[#9a8c74]">
                {s.press}:{" "}
                <a href={territorio.imprensa.url} className="text-[#f0cf8e] underline-offset-2 hover:underline" rel="noopener noreferrer" target="_blank">
                  {territorio.imprensa.veiculo}: {territorio.imprensa.titulo}
                </a>
              </p>
            )}
            <Untranslated lang={lang} t={t} show={lang !== "pt"} />
          </div>
          {territorio.foto ? (
            <div className="relative mx-auto w-full max-w-[30rem] pt-6 pr-6">
              {territorio.fotoAtras && (
                <Image src={territorio.fotoAtras.src} alt="" width={640} height={640} sizes="(min-width: 768px) 28rem, 85vw" className="absolute top-0 right-0 aspect-square h-auto w-[88%] rotate-[4deg] border-2 border-[#f4ecd8] object-cover opacity-90" />
              )}
              <Image src={territorio.foto.src} alt={territorio.foto.alt} width={640} height={640} priority sizes="(min-width: 768px) 28rem, 85vw" className="relative aspect-square h-auto w-[92%] -rotate-2 border-2 border-[#f4ecd8] object-cover shadow-[10px_10px_0_#e01b22]" />
            </div>
          ) : (
            territorio.edicoes[0] && (
              <div className="mx-auto w-full max-w-[22rem] rotate-1">
                <CapaDaEdicao edicao={territorio.edicoes[0]} perfil={territorio.instagram} assinatura={s.byCollective} grande />
              </div>
            )
          )}
        </div>
      </section>

      <Letreiro temas={territorio.temas} />

      <div className="mx-auto max-w-[78rem] px-4 sm:px-8">
        {/* As edições: cada série é uma revista. */}
        <section className="pt-14">
          <p className={`${tag} text-[#c21f16]`}>{s.editions}</p>
          <h2 className="mt-1.5 font-serif text-[2.75rem] font-medium leading-tight">{s.editionsTitle}</h2>
          <ul className="mt-7 grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-5">
            {territorio.edicoes.map((edicao) => (
              <li key={edicao.titulo}>
                <a href={instagram} rel="noopener noreferrer" target="_blank" className="block">
                  <CapaDaEdicao edicao={edicao} perfil={territorio.instagram} assinatura={s.byCollective} />
                </a>
              </li>
            ))}
          </ul>
        </section>

        {/* A editoria no jornal: as análises (ou, enquanto não saem, as pautas com as fotos do coletivo). */}
        <section className="pt-16">
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-b-[3px] border-ink pb-2.5">
            <div>
              <p className={`${tag} text-[#c21f16]`}>{s.journalKicker}</p>
              <h2 className="mt-1.5 font-serif text-[2.5rem] font-medium leading-tight">{s.journalTitle.replace("{editoria}", "")}<em>{territorio.editoria}</em></h2>
            </div>
            <Link href={to("/jornal")} className="font-sans font-bold text-[#c21f16] hover:underline">{s.journalAll} →</Link>
          </div>
          {materias.length > 0 ? (
            <ul className="mt-6 grid gap-6 sm:grid-cols-3">
              {materias.map((materia) => (
                <li key={materia.slug}>
                  <p className={`${tag} text-[#c21f16]`}>{materia.author}</p>
                  <Link href={to(`/jornal/${materia.slug}`)} className="mt-1 block font-serif text-2xl font-semibold leading-snug hover:text-prelo-texto">{materia.title}</Link>
                  {materia.subtitle && <p className="mt-1 text-ink-soft">{materia.subtitle}</p>}
                </li>
              ))}
            </ul>
          ) : principal ? (
            <div className="mt-6 grid gap-6 md:grid-cols-[2fr_1fr_1fr]">
              <article>
                <Image src={principal.imagem} alt={principal.alt} width={512} height={640} sizes="(min-width: 768px) 38rem, 92vw" className="aspect-video h-auto w-full border border-ink/30 object-cover object-[50%_35%]" />
                <p className={`mt-3 ${tag} text-[#c21f16]`}>{principal.chapeu}</p>
                <h3 className="mt-1 font-serif text-[1.75rem] font-semibold leading-[1.1]">{principal.titulo}</h3>
                {principal.resumo && <p className="mt-2 text-ink-soft">{principal.resumo}</p>}
              </article>
              {outros.map((d) => (
                <article key={d.titulo}>
                  <Image src={d.imagem} alt={d.alt} width={360} height={640} sizes="(min-width: 768px) 18rem, 92vw" className="aspect-[4/3] h-auto w-full border border-ink/30 object-cover" />
                  <p className={`mt-3 ${tag} text-[#c21f16]`}>{d.chapeu}</p>
                  <h3 className="mt-1 font-serif text-[1.35rem] font-semibold leading-[1.15]">{d.titulo}</h3>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-6 text-ink-soft">{s.journalEmpty}</p>
          )}
        </section>

        {/* As trilhas: a quebrada também é escola. */}
        {daqui.length > 0 && (
          <section className="pt-16">
            <p className={`${tag} text-[#c21f16]`}>{s.learnKicker}</p>
            <h2 className="mt-1.5 font-serif text-[2.5rem] font-medium leading-tight">{s.learnTitle}</h2>
            <ul className="mt-6 grid gap-5 md:grid-cols-3">
              {daqui.map((track, i) => (
                <li key={track.slug}>
                  <Link
                    href={to(`/trilhas/${track.slug}`)}
                    className={`flex h-full flex-col p-[22px] no-underline ${i === 0 ? "bg-[#1f1a14] text-[#f4ecd8] shadow-[6px_6px_0_#e01b22] hover:text-[#f4ecd8]" : "border-2 border-[#1f1a14] bg-[#fbf8f1] text-[#1f1a14] shadow-[6px_6px_0_#1f1a14] hover:text-[#1f1a14]"}`}
                  >
                    <span className={`${tag} ${i === 0 ? "text-[#e0837a]" : "text-[#c21f16]"}`}>
                      {areas[track.area]?.[0] ?? track.area} · {s.lessons.replace("{n}", String(track.lessons.length + track.plan.filter((p) => !p.ready).length))}
                    </span>
                    <span className="mt-2.5 font-serif text-[1.6rem] font-semibold leading-[1.1]">{track.title}</span>
                    <span className={`mt-2.5 text-sm ${i === 0 ? "text-[#cdbb91]" : "text-[#5a4e3c]"}`}>{track.summary}</span>
                    {track.lessons.length === 0 && <span className={`mt-4 self-start border border-dashed px-1.5 py-0.5 ${tag}`}>{s.soon}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* A cápsula de roupas, em preparação. */}
      {territorio.capsula && (
        <section className="mt-[4.5rem] bg-[#0f0d0b] text-[#f4ecd8]">
          <div className="mx-auto grid max-w-[78rem] items-center gap-10 px-4 py-14 sm:px-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
            <div className="min-w-0">
              <p className={`${tag} text-[#e0837a]`}>{s.capsuleKicker}</p>
              <h2 className="territorio-play mt-2.5 text-[3.5rem] font-black uppercase leading-[0.95]">{territorio.capsula.nome}</h2>
              <p className="mt-4 leading-relaxed text-[#cdbb91]">{territorio.capsula.texto}</p>
              <a href={instagram} className={`${botao} mt-6 border-[#e01b22] bg-[#e01b22] text-white hover:text-white`} rel="noopener noreferrer" target="_blank">{s.followUpdates}</a>
            </div>
            <ul className="grid grid-cols-3 gap-3">
              {territorio.capsula.pecas.map((peca, i) => (
                <li key={peca} className={`flex aspect-[3/4] max-w-full flex-col justify-between border-2 border-[#f4ecd8]/70 p-3 [background:repeating-linear-gradient(135deg,#2a2420_0_10px,#231e1a_10px_20px)] ${i === 1 ? "mt-10" : ""}`}>
                  <span className={`${tag} text-[#9a8c74]`}>Look {String(i + 1).padStart(2, "0")}</span>
                  <span className="font-serif text-base font-semibold leading-tight sm:text-lg">{peca}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <div className="mx-auto max-w-[78rem] px-4 sm:px-8">
        {/* O podcast e o lançamento, os dois em preparação. */}
        {(territorio.podcast || territorio.lancamento) && (
          <section className="grid gap-6 pt-14 pb-16 md:grid-cols-2">
            {territorio.podcast && (
              <div className="border-2 border-[#1f1a14] bg-[#fbf8f1] p-6 text-[#1f1a14] shadow-[6px_6px_0_#1f1a14]">
                <p className={`${tag} text-[#c21f16]`}>{s.podcastKicker}</p>
                <p className="mt-2 font-serif text-[1.75rem] font-semibold leading-[1.1]">{territorio.podcast.titulo}</p>
                <p className="mt-2 text-sm text-[#5a4e3c]">{territorio.podcast.com}</p>
                <Link href={to("/podcasts")} className={`${botao} mt-4 border-[#1f1a14] bg-[#1f1a14] text-[#f4ecd8] hover:text-[#f4ecd8]`}>{t.nav.podcasts} →</Link>
              </div>
            )}
            {territorio.lancamento && (
              <div className="border-2 border-[#1f1a14] bg-[#e01b22] p-6 text-white shadow-[6px_6px_0_#1f1a14]">
                <p className={tag}>{s.launchKicker}</p>
                <p className="mt-2 font-serif text-[1.75rem] font-semibold leading-[1.1]">{territorio.lancamento.titulo}</p>
                <a href={instagram} className={`${botao} mt-4 border-[#1f1a14] bg-white text-[#1f1a14] hover:text-[#1f1a14]`} rel="noopener noreferrer" target="_blank">{s.followUpdates}</a>
              </div>
            )}
          </section>
        )}
        {territorio.credito && <p className="pb-8 font-sans text-xs text-ink-soft">{territorio.credito}</p>}
      </div>

      {/* O convite: o próximo território pode ser o seu. */}
      <footer className="border-t-[3px] border-ink">
        <div className="mx-auto flex max-w-[78rem] flex-wrap items-center gap-4 px-4 py-7 sm:px-8">
          <p className="min-w-[16rem] flex-1 font-serif text-2xl">{s.nextTitle}</p>
          <a href={`mailto:${site.newsletter}?subject=${encodeURIComponent(s.nextCta)}`} className={`${botao} border-[#1f1a14] bg-[#1f1a14] text-[#f4ecd8] hover:text-[#f4ecd8]`}>{s.nextCta}</a>
          <a href={site.instagram} className={`${botao} border-[#1f1a14] text-[#1f1a14]`} rel="noopener noreferrer" target="_blank">@{site.instagramUser}</a>
        </div>
        <p className="mx-auto max-w-[78rem] px-4 pb-6 font-mono text-xs select-all text-ink-soft sm:px-8">{site.newsletter}</p>
      </footer>
    </div>
  );
}
