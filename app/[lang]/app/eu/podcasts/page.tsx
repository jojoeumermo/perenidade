// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import Link from "@/components/Link";
import { htmlLang, localePath } from "@/i18n/config";
import { loadLang } from "@/i18n";
import { minutos } from "@/lib/podcast";
import { catalogo } from "@/lib/podcast-servidor";
import { site } from "@/lib/site";

export const revalidate = 1800;

const plataformas: [string, string][] = [
  ["spotify", "Spotify"],
  ["apple", "Apple Podcasts"],
  ["youtube", "YouTube Music"],
  ["deezer", "Deezer"],
  ["amazon", "Amazon Music"],
  ["archive", "Internet Archive"],
];

/**
 * Podcasts dentro do aplicativo (aba Eu): a lista dos episódios (mais novo primeiro), onde assinar e o endereço do feed.
 * Sem episódio publicado mostra o aviso "em breve". Tocar um episódio ainda abre a página do site (o tocador mora lá):
 * pendência registrada, não tratada como pronta.
 */
export default async function PodcastsDoApp({ params }: PageProps<"/[lang]/app/eu/podcasts">) {
  const { lang, t } = await loadLang(params);
  const s = t.podcast;
  const { config, episodios } = await catalogo();
  const data = new Intl.DateTimeFormat(htmlLang[lang], { day: "numeric", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" });
  const links = plataformas.filter(([chave]) => config?.links?.[chave as keyof typeof config.links]);
  return (
    <div className="app-hub app-podcasts-tela">
      <header className="app-hub-cabeca">
        <h1>{s.title}</h1>
        <p>{s.lead}</p>
      </header>
      {episodios.length === 0 ? (
        <section className="app-estado app-estado-vazio" data-podcasts-vazio="">
          <strong>{s.soon}</strong>
          <p>{s.soonText}</p>
        </section>
      ) : (
        <ol className="app-podcasts-lista">
          {episodios.slice(0, 40).map((e) => (
            <li key={e.id}>
              <Link href={localePath(lang, `/podcasts/${e.slug}`)} className="app-cartao app-podcasts-episodio">
                <span className="app-cartao-titulo app-cartao-titulo-menor">{e.titulo}</span>
                <span className="app-cartao-texto">
                  {data.format(new Date(e.publicado_em))} · {minutos(e.duracao)}
                  {e.serie ? ` · ${e.serie.titulo}` : ""}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
      <section className="app-podcasts-assinar" aria-label={s.subscribe}>
        <h2 className="app-cartao-titulo app-cartao-titulo-menor">{s.subscribe}</h2>
        <p>{s.subscribeLead}</p>
        <ul>
          {links.map(([chave, nome]) => (
            <li key={chave}>
              <a href={config?.links?.[chave as keyof typeof config.links]} target="_blank" rel="noopener noreferrer">
                {nome} ↗
              </a>
            </li>
          ))}
          <li>
            <a href={`${site.url}/podcast.xml`} data-feed-rss="">
              RSS
            </a>
          </li>
        </ul>
      </section>
      <Link href={localePath(lang, "/app/eu/radio")} className="app-cartao app-podcasts-radio">
        <span className="app-cartao-titulo app-cartao-titulo-menor">{t.nav.radio}</span>
      </Link>
    </div>
  );
}
