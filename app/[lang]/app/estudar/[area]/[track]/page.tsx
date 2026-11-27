// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { notFound, redirect } from "next/navigation";
import { ContinuarEstudo, ListaDaTrilha, type AulaDaJornada } from "@/components/app/jornada";
import { textosDoAppNovo } from "@/components/app/textos-app";
import { loadLang } from "@/i18n";
import { fill, localePath } from "@/i18n/config";
import { getTrack } from "@/lib/content";
import { lessonId } from "@/lib/ids";
import { areaNaEscola } from "@/lib/escola/aulas-abertas";

export const revalidate = 3600;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

/** A tela de uma trilha no aplicativo: o resumo, o botão de continuar e os passos (aulas) com a marca de concluída. */
export default async function TrilhaDoApp({ params }: PageProps<"/[lang]/app/estudar/[area]/[track]">) {
  const { lang, t } = await loadLang(params);
  const { area, track: slug } = await params;
  const track = getTrack(slug, lang);
  // "ir": atalho da busca, que só sabe a trilha; leva para o endereço com a disciplina certa.
  if (track && area === "ir" && !areaNaEscola(track.area)) redirect(localePath(lang, `/app/estudar/${track.area}/${track.slug}`));
  if (!track || track.area !== area || areaNaEscola(track.area)) notFound();
  const s = textosDoAppNovo(lang);
  const minutos = track.lessons.reduce((soma, l) => soma + l.minutes, 0);
  const minutosDe = new Map(track.lessons.map((l) => [l.slug, l.minutes]));
  const aulas: AulaDaJornada[] = track.plan.map((item) => ({
    id: lessonId(track.slug, item.slug),
    href: `/app/estudar/${area}/${track.slug}/${item.slug}`,
    title: item.title,
    minutos: minutosDe.get(item.slug),
    ready: item.ready !== false,
  }));
  return (
    <div className="app-hub">
      <header className="app-hub-cabeca">
        <p className="app-trilha-trilho">
          {t.areas[track.area][0]} · {t.stages[track.stage]} · {fill(t.tracks.minutes, { n: minutos })}
        </p>
        <h1>{track.title}</h1>
        <p>{track.summary}</p>
      </header>
      <ContinuarEstudo aulas={aulas} />
      <section className="app-secao" aria-label={t.nav.disciplines}>
        <ListaDaTrilha aulas={aulas} />
      </section>
    </div>
  );
}
