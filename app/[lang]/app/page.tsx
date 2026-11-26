// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { AulaDoDia } from "@/components/app/AulaDoDia";
import type { AulaSugerida } from "@/components/app/aula-do-dia";
import { ContinuarDoApp, SaudacaoDoApp } from "@/components/app/inicio";
import { textosDoAppNovo } from "@/components/app/textos-app";
import { L } from "@/components/I18n";
import { Ladrilhos } from "@/components/celular/Atalhos";
import { JanelaAulaDaSemana } from "@/components/inicio/AulaDaSemana";
import { LambeDoDia } from "@/components/inicio/LambeDoDia";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { aulasDaSemana } from "@/lib/aula-da-semana";
import { groups } from "@/lib/areas";
import { corDaCapa } from "@/lib/capas";
import { getBooks, getCatalog, getTracks } from "@/lib/content";
import { lambesDoCartaz } from "@/lib/lambes";
import { site } from "@/lib/site";
import comecar from "@/content/comecar.json";

// Refeita a cada hora, como a inicial do site.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Instituto Lúcia",
};

const numero = (lang: string, n: number) => new Intl.NumberFormat(lang).format(n);

/**
 * O Início da experiência própria do aplicativo instalado (sem a Alumia, que no aplicativo não existe): cumprimento,
 * busca, continuar de onde parou, aula do dia, atalhos, o muro, a aula da semana e as estantes. Os dados são os mesmos
 * da inicial do site (content/ e lib/); o desenho e a ordem são do aplicativo (app/app-instalado.css).
 */
export default async function InicioDoApp({ params }: PageProps<"/[lang]/app">) {
  const { lang, t } = await loadLang(params);
  const h = t.home;
  const n = textosDoAppNovo(lang);
  const tracks = getTracks(lang);
  const books = getBooks(lang);
  const lessons = tracks.reduce((sum, track) => sum + track.lessons.length, 0);
  const areas = groups.flatMap((group) => group.areas).length;
  const works = books.length + groups.flatMap((group) => group.areas).reduce((sum, area) => sum + getCatalog(area).length, 0);
  const tiragem = `${h.posterPrint}: ${[
    [numero(lang, areas), t.common.disciplines.other.replace("{n}", "").trim()],
    [numero(lang, lessons), t.common.lessons.other.replace("{n}", "").trim()],
    [numero(lang, works), t.common.works.other.replace("{n}", "").trim()],
  ]
    .map(([valor, nome]) => `${valor} ${nome}`)
    .join(" · ")}`;

  // A "aula do dia": as aulas curtas do "Comece aqui" que já existem neste idioma (a mesma regra da casca).
  const aulasDoDia: AulaSugerida[] = comecar
    .flatMap((bloco) => bloco.aulas)
    .flatMap((id) => {
      const [trilha, aula] = id.split("/");
      const track = tracks.find((item) => item.slug === trilha);
      const lesson = track?.lessons.find((item) => item.slug === aula);
      return track && lesson ? [{ href: `/trilhas/${track.slug}/${lesson.slug}`, titulo: lesson.title, trilha: track.title, minutos: lesson.minutes }] : [];
    });

  // As estantes da fileira: as que já têm aula, as mais cheias primeiro, cada uma com a cor da sua capa.
  const aulasPorEstante = new Map<string, number>();
  for (const track of tracks) aulasPorEstante.set(track.area, (aulasPorEstante.get(track.area) ?? 0) + track.lessons.length);
  const estantes = groups
    .flatMap((group) => group.areas.map((slug) => ({ slug, grupo: t.groups[group.id], n: aulasPorEstante.get(slug) ?? 0 })))
    .filter((estante) => estante.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 12)
    .map((estante) => ({ slug: estante.slug, nome: t.areas[estante.slug][0], etapa: estante.grupo, aulas: `${numero(lang, estante.n)} ${estante.n === 1 ? t.common.lessons.one : t.common.lessons.other}`, cor: corDaCapa(estante.slug) }));

  return (
    <div className="app-inicio">
      <SaudacaoDoApp />

      <form action={localePath(lang, "/busca")} role="search" className="app-busca">
        <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="M15.5 15.5 20 20" />
        </svg>
        <input name="q" type="search" aria-label={h.searchLabel} placeholder={h.searchPlaceholder} />
        <button>{h.searchButton}</button>
      </form>

      <ContinuarDoApp textos={{ continuar: t.tracks.continue, retomar: t.tracks.resume, comecar: t.nav.start, comecarTexto: h.startText }} />

      <AulaDoDia aulas={aulasDoDia} />

      <section className="app-secao" aria-label={n.atalhos}>
        <Ladrilhos chaves={["radio", "podcasts", "journal", "news", "glossary", "labs", "questionBank", "live"]} rotulo={n.atalhos} rotas={{ radio: "/app/eu/radio", podcasts: "/app/eu/podcasts", journal: "/app/eu/jornal", labs: "/app/jogos/laboratorios" }} />
      </section>

      <section className="app-secao" aria-label={n.noMuro}>
        <h2 className="app-titulo-secao">{n.noMuro}</h2>
        <LambeDoDia dias={lambesDoCartaz(lang)} rotulo={h.posterLabel} reserva={h.stamp} tiragem={tiragem} />
      </section>

      <section className="app-secao" aria-label={t.aulaDaSemana?.titulo ?? undefined}>
        <JanelaAulaDaSemana semanas={aulasDaSemana(lang)} lang={lang} url={site.url} s={t.aulaDaSemana} sc={t.compartilhar} area={Object.fromEntries(Object.entries(t.areas).map(([k, v]) => [k, v[0]]))} />
      </section>

      <section className="app-secao" aria-label={n.estantes}>
        <div className="app-secao-cabeca">
          <h2 className="app-titulo-secao">{n.estantes}</h2>
          <L href="/app/estudar" className="app-ver-tudo">
            {n.verTudo}
          </L>
        </div>
        <ul className="app-estantes">
          {estantes.map((estante) => (
            <li key={estante.slug}>
              <L href={`/estantes/${estante.slug}`} className="caderno" style={{ background: estante.cor }}>
                <span className="caderno-etapa">{estante.etapa}</span>
                <span className="etiqueta caderno-nome">{estante.nome}</span>
                <span className="caderno-aulas">{estante.aulas} →</span>
              </L>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
