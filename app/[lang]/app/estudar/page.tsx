// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { L } from "@/components/I18n";
import { ContinuarDoApp } from "@/components/app/inicio";
import { textosDoAppNovo } from "@/components/app/textos-app";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { essential, groups, stages, type Stage } from "@/lib/areas";
import { getTracks } from "@/lib/content";

export const revalidate = 3600;

/**
 * A aba Estudar do aplicativo instalado: continuar de onde parou e as disciplinas em lista de aplicativo, agrupadas por
 * estante, cada uma com as aulas prontas. Os dados são os da página /trilhas do site; a tela é própria do aplicativo.
 */
export default async function EstudarDoApp({ params }: PageProps<"/[lang]/app/estudar">) {
  const { lang, t } = await loadLang(params);
  const n = textosDoAppNovo(lang);
  const tracks = getTracks(lang);
  const estantes = groups.map((group) => ({
    id: group.id,
    title: t.groups[group.id],
    areas: group.areas
      .map((slug) => {
        const counts = Object.fromEntries(stages.map((stage) => [stage, [0, 0]])) as Record<Stage, [number, number]>;
        for (const track of tracks) {
          if (track.area !== slug) continue;
          counts[track.stage][0] += track.lessons.length;
          counts[track.stage][1] += track.plan.length;
        }
        return { slug, name: t.areas[slug][0], description: t.areas[slug][1], essential: essential.includes(slug), counts };
      })
      .sort((a, b) => b.counts.fundamental[0] + b.counts.medio[0] + b.counts.superior[0] - (a.counts.fundamental[0] + a.counts.medio[0] + a.counts.superior[0])),
  }));

  return (
    <div className="app-hub">
      <header className="app-hub-cabeca">
        <h1>{t.tracks.title}</h1>
        <p>{n.estudarLead}</p>
      </header>

      <ContinuarDoApp textos={{ continuar: t.tracks.continue, retomar: t.tracks.resume, comecar: t.nav.start, comecarTexto: t.home.startText }} />

      <form action={localePath(lang, "/busca")} role="search" className="app-busca">
        <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="M15.5 15.5 20 20" />
        </svg>
        <input name="q" type="search" aria-label={t.tracks.searchLabel} placeholder={t.tracks.searchPlaceholder} />
        <button>{t.home.searchButton}</button>
      </form>

      {estantes.map((estante) => (
        <section key={estante.id} className="app-secao" aria-label={estante.title}>
          <h2 className="app-titulo-secao">{estante.title}</h2>
          <ul className="app-lista">
            {estante.areas.map((area) => {
              const prontas = area.counts.fundamental[0] + area.counts.medio[0] + area.counts.superior[0];
              return (
                <li key={area.slug}>
                  <L href={`/app/estudar/${area.slug}`} className="app-item-lista">
                    <span className="app-item-texto">
                      <span className="app-item-titulo">
                        {area.essential ? "★ " : ""}
                        {area.name}
                      </span>
                      <span className="app-item-aux">{area.description}</span>
                    </span>
                    <span className="app-item-num">{prontas > 0 ? n.aulas(prontas) : "→"}</span>
                  </L>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
