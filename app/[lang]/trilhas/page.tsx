// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
import type { Metadata } from "next";
import { DisciplineBrowser, type DisciplineGroup } from "@/components/DisciplineBrowser";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { essential, groups, stages, type Stage } from "@/lib/areas";
import { getTracks } from "@/lib/content";

export async function generateMetadata({ params }: PageProps<"/[lang]/trilhas">): Promise<Metadata> {
  const { t } = await loadLang(params);
  return { title: t.tracks.title, description: t.tracks.description };
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
      return { slug, name: t.areas[slug][0], description: t.areas[slug][1], essential: essential.includes(slug), counts };
    }),
  }));
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <PageHeading eyebrow={t.tracks.eyebrow} title={t.tracks.title}>
        {t.tracks.lead}
      </PageHeading>
      <DisciplineBrowser groups={data} s={t.tracks} stageNames={t.stages} />
    </div>
  );
}
