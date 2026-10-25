// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "@/components/Link";
import { CopyButton } from "@/components/CopyButton";
import { Destaque } from "@/components/podcast/Destaque";
import { Explorar } from "@/components/podcast/Explorar";
import { PergunteAoPodcast, VotacaoDePautas } from "@/components/podcast/Participar";
import { MarcarVisto } from "@/components/podcast/Partes";
import { loadLang } from "@/i18n";
import { alternatesDe, paginaMeta } from "@/lib/seo";
import { htmlLang, localePath } from "@/i18n/config";
import { minutos } from "@/lib/podcast";
import { catalogo } from "@/lib/podcast-servidor";
import { site } from "@/lib/site";

// Episódio publicado no painel aparece aqui em até meia hora (refazer a página com menos frequência poupa a cota da Vercel).
export const revalidate = 1800;

export async function generateMetadata({ params }: PageProps<"/[lang]/podcasts">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return { ...paginaMeta(lang, "/podcasts", t.podcast.title, t.podcast.lead), alternates: { ...alternatesDe(lang, "/podcasts"), types: { "application/rss+xml": `${site.url}/podcast.xml` } } };
}

const plataformas: [string, string][] = [
  ["spotify", "Spotify"],
  ["apple", "Apple Podcasts"],
  ["youtube", "YouTube Music"],
  ["deezer", "Deezer"],
  ["amazon", "Amazon Music"],
  ["archive", "Internet Archive"],
];

/**
 * A casa do podcast, no jeito dos aplicativos de áudio e com a cara do instituto: o cartaz no alto, o episódio mais novo
 * em destaque com o play grande, as prateleiras por série e por tema, a lista completa e, embaixo, a participação:
 * votação de pautas, perguntas para o programa e onde assinar.
 */
export default async function Podcasts({ params }: PageProps<"/[lang]/podcasts">) {
  const { lang, t } = await loadLang(params);
  const s = t.podcast;
  const { config, series, episodios } = await catalogo();
  const programa = config?.nome || s.title;
  const novo = episodios[0];
  const data = new Intl.DateTimeFormat(htmlLang[lang], { day: "numeric", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
  const areas = Object.fromEntries(Object.entries(t.areas).map(([slug, [nome]]) => [slug, nome]));
  const links = plataformas.filter(([chave]) => config?.links?.[chave as keyof typeof config.links]);
  const feed = `${site.url}/podcast.xml`;

  return (
    <>
      <MarcarVisto ultimo={novo?.publicado_em ?? null} />
      {novo ? (
        <Destaque e={novo} fila={episodios} programa={programa} s={s} lang={lang} data={data.format(new Date(novo.publicado_em))} />
      ) : (
        <section className="border-b-4 border-[#c21f16] bg-[#1f1a14] text-[#f4ecd8]">
          <div className="mx-auto grid max-w-[78rem] items-center gap-10 px-4 py-12 sm:px-6 md:grid-cols-[18rem_minmax(0,1fr)] lg:px-8">
            <div aria-hidden className="mx-auto flex aspect-square w-full max-w-[13rem] md:max-w-[18rem] -rotate-2 flex-col justify-between border-[3px] border-[#f4ecd8] bg-[#c21f16] p-6 text-white shadow-[8px_8px_0_#f4ecd8]">
              <span className="font-mono text-xs font-semibold tracking-[0.2em] uppercase">{s.eyebrow}</span>
              <span className="font-sans text-[2.6rem] font-black uppercase italic leading-[0.92]">{s.soon}</span>
              <span className="font-mono text-[0.68rem] tracking-[0.16em] uppercase">{programa}</span>
            </div>
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.24em] text-[#e0837a]">● {s.title}</p>
              <h1 className="mt-2.5 font-serif text-[2.3rem] font-medium leading-[1.04] sm:text-[3.3rem]">{s.heroTitle}</h1>
              <p className="mt-4 max-w-2xl text-lg leading-snug text-[#e9dcbc]">{s.soonText}</p>
              <Link href={localePath(lang, "/podcasts/microfone")} className="botao botao-prelo mt-6">
                {s.recordWithUs} →
              </Link>
            </div>
          </div>
        </section>
      )}

      <div className="pont border-b-[3px] border-ink">
        <div className="mx-auto max-w-[78rem] px-4 pt-6 pb-12 sm:px-6 lg:px-8">
          <p className="max-w-3xl pt-4 font-serif text-xl leading-snug text-ink-soft">{config?.descricao ? <span lang="pt-BR">{config.descricao}</span> : s.lead}</p>
          {episodios.length > 0 && <Explorar episodios={episodios} series={series} s={s} lang={lang} programa={programa} areas={areas} />}
        </div>
      </div>

      <div className="mx-auto max-w-[78rem] px-4 sm:px-6 lg:px-8">
        <div className="mt-12 grid gap-8 lg:grid-cols-2">
          <VotacaoDePautas s={s} />
          <PergunteAoPodcast s={s} />
        </div>

        <section aria-labelledby="assinar" className="cartao mt-12 p-6 sm:p-8">
          <p className="rotulo">{s.eyebrow}</p>
          <h2 id="assinar" className="mt-1 font-serif text-3xl font-semibold">{s.subscribe}</h2>
          <p className="mt-2 max-w-3xl text-lg text-ink-soft">{s.subscribeLead}</p>
          <ul className="mt-5 flex flex-wrap gap-3 font-sans text-sm font-semibold">
            {links.map(([chave, nome]) => (
              <li key={chave}>
                <a href={config?.links?.[chave as keyof typeof config.links]} target="_blank" rel="noopener noreferrer" className="botao botao-papel botao-menor">
                  {nome} ↗
                </a>
              </li>
            ))}
            <li className="flex flex-wrap items-center gap-2 border-2 border-dashed border-ink px-4 py-2">
              <span>RSS</span>
              <code className="break-all font-mono text-xs font-normal">{feed}</code>
              <CopyButton text={feed} label={s.copyFeed} done={s.copied} className="underline" />
            </li>
          </ul>
          <p className="mt-6 font-sans text-sm text-ink-soft">
            {s.guestNote}{" "}
            <Link href={localePath(lang, "/podcasts/microfone")} className="underline hover:text-oxblood">
              {s.micTitle}
            </Link>
            {" · "}
            <Link href={localePath(lang, "/radio")} className="underline hover:text-oxblood">
              {t.nav.radio}
            </Link>
          </p>
        </section>
      </div>
    </>
  );
}
