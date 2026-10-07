import type { Metadata } from "next";
import { TrackCard } from "@/components/Cards";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { areaSlugs } from "@/lib/areas";
import { getTracks } from "@/lib/content";

export async function generateMetadata({ params }: PageProps<"/[lang]/trilhas">): Promise<Metadata> {
  const { t } = await loadLang(params);
  return { title: t.tracks.title, description: t.tracks.description };
}

export default async function Trilhas({ params }: PageProps<"/[lang]/trilhas">) {
  const { lang, t } = await loadLang(params);
  const tracks = getTracks(lang);
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <PageHeading eyebrow={t.tracks.eyebrow} title={t.tracks.title}>
        {t.tracks.lead}
      </PageHeading>
      {areaSlugs.map((area) => {
        const inArea = tracks.filter((track) => track.area === area);
        if (inArea.length === 0) return null;
        return (
          <section key={area}>
            <h2 className="mt-12 border-b border-rule pb-3 text-3xl font-semibold">{t.areas[area][0]}</h2>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {inArea.map((track) => (
                <TrackCard key={track.slug} track={track} lang={lang} t={t} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
