// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { DisciplineBrowser, type DisciplineGroup } from "@/components/DisciplineBrowser";
import { GuiaDasDisciplinas } from "@/components/GuiaDasDisciplinas";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";
import { essential, groups, stages, type Stage } from "@/lib/areas";
import { getTracks } from "@/lib/content";
import { caminhosDoGuia } from "@/lib/guia-disciplinas";

export async function generateMetadata({ params }: PageProps<"/[lang]/trilhas">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/trilhas", t.tracks.title, t.tracks.description);
}

export default async function Disciplinas({ params }: PageProps<"/[lang]/trilhas">) {
  const { lang, t } = await loadLang(params);
  const tracks = getTracks(lang);
  const data: DisciplineGroup[] = groups.map((group) => ({
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
  return (
    <div className="estantes-do-site mx-auto max-w-6xl px-4 py-12">
      <PageHeading eyebrow={t.tracks.eyebrow} title={t.tracks.title}>
        {t.tracks.lead}
      </PageHeading>
      <GuiaDasDisciplinas caminhos={caminhosDoGuia(tracks, stages)} s={t.tracks.guide} etapas={stages} />
      <DisciplineBrowser groups={data} s={t.tracks} stageNames={t.stages} />
    </div>
  );
}
