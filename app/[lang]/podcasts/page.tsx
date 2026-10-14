// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "next/link";
import { Cartaz } from "@/components/Cartaz";
import { CopyButton } from "@/components/CopyButton";
import { Capa } from "@/components/podcast/Capa";
import { Explorar } from "@/components/podcast/Explorar";
import { Ouvir } from "@/components/podcast/Ouvir";
import { PergunteAoPodcast, VotacaoDePautas } from "@/components/podcast/Participar";
import { MarcarVisto } from "@/components/podcast/Partes";
import { loadLang } from "@/i18n";
import { htmlLang, localePath } from "@/i18n/config";
import { minutos } from "@/lib/podcast";
import { catalogo } from "@/lib/podcast-servidor";
import { site } from "@/lib/site";

// Episódio publicado no painel aparece aqui em até cinco minutos.
export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<"/[lang]/podcasts">): Promise<Metadata> {
  const { t } = await loadLang(params);
  return { title: t.podcast.title, description: t.podcast.lead, alternates: { types: { "application/rss+xml": `${site.url}/podcast.xml` } } };
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
    <div className="mx-auto max-w-6xl px-4 py-8">
      <MarcarVisto ultimo={novo?.publicado_em ?? null} />
      <Cartaz eyebrow={s.eyebrow} title={s.title} slogan={t.footer.slogan} tone="vermelho">
        {config?.descricao ? <span lang="pt-BR">{config.descricao}</span> : s.lead}
      </Cartaz>

      {novo ? (
        <section aria-labelledby="destaque" className="mt-8 grid gap-6 border-4 border-ink bg-ink p-4 text-parchment sm:p-6 md:grid-cols-[minmax(0,18rem)_1fr] md:items-center">
          <Link href={localePath(lang, `/podcasts/${novo.slug}`)} tabIndex={-1} aria-hidden>
            <Capa caminho={novo.capa} titulo={novo.titulo} numero={novo.numero} grande className="border-2 border-parchment" />
          </Link>
          <div className="min-w-0" lang="pt-BR">
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-gold">
              <span className="mr-2 bg-[#c21f16] px-1.5 py-0.5 text-white">{s.newest}</span>
              {[novo.serie?.titulo, novo.temporada ? `${s.season} ${novo.temporada}` : "", novo.numero != null ? `${s.episode} ${novo.numero}` : ""].filter(Boolean).join(" · ")}
            </p>
            <h2 id="destaque" className="mt-3 font-sans text-3xl font-black uppercase italic leading-[0.95] sm:text-5xl">
              <Link href={localePath(lang, `/podcasts/${novo.slug}`)} className="hover:text-gold">{novo.titulo}</Link>
            </h2>
            {novo.resumo && <p className="mt-4 max-w-2xl text-lg leading-snug opacity-85">{novo.resumo}</p>}
            <p className="mt-3 font-mono text-xs opacity-75">
              {data.format(new Date(novo.publicado_em))} · {minutos(novo.duracao)}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Ouvir episodio={novo} fila={episodios} programa={programa} rotulo={s.listen} pausar={s.pause} grande className="shadow-[0_3px_0_#c21f16]" />
              <Link href={localePath(lang, `/podcasts/${novo.slug}`)} className="border-2 border-parchment px-5 py-2.5 font-sans text-sm font-semibold hover:bg-parchment hover:text-ink">
                {s.openEpisode}
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <section className="mt-8 border-4 border-ink p-8 text-center">
          <p className="font-sans text-3xl font-black uppercase italic">{s.soon}</p>
          <p className="mx-auto mt-3 max-w-xl text-lg text-ink-soft">{s.soonText}</p>
        </section>
      )}

      {episodios.length > 0 && <Explorar episodios={episodios} series={series} s={s} lang={lang} programa={programa} areas={areas} />}

      <div className="mt-14 grid gap-6 lg:grid-cols-2">
        <VotacaoDePautas s={s} />
        <PergunteAoPodcast s={s} />
      </div>

      <section aria-labelledby="assinar" className="mt-14">
        <h2 id="assinar" className="jornal-secao">
          <span className="jornal-editoria">{s.subscribe}</span>
        </h2>
        <p className="mt-3 max-w-3xl text-ink-soft">{s.subscribeLead}</p>
        <ul className="mt-4 flex flex-wrap gap-3 font-sans text-sm font-semibold">
          {links.map(([chave, nome]) => (
            <li key={chave}>
              <a href={config?.links?.[chave as keyof typeof config.links]} target="_blank" rel="noopener noreferrer" className="inline-block border-2 border-ink px-4 py-2 hover:bg-ink hover:text-parchment">
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
          {s.guestNote} <Link href={localePath(lang, "/podcasts/microfone")} className="underline hover:text-oxblood">{s.micTitle}</Link>.
        </p>
      </section>
    </div>
  );
}
