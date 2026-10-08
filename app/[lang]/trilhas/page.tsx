// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { fill, localePath } from "@/i18n/config";
import { groups } from "@/lib/areas";
import { getTracks } from "@/lib/content";

export async function generateMetadata({ params }: PageProps<"/[lang]/trilhas">): Promise<Metadata> {
  const { t } = await loadLang(params);
  return { title: t.tracks.title, description: t.tracks.description };
}

export default async function Disciplinas({ params }: PageProps<"/[lang]/trilhas">) {
  const { lang, t } = await loadLang(params);
  const tracks = getTracks(lang);
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <PageHeading eyebrow={t.tracks.eyebrow} title={t.tracks.title}>
        {t.tracks.lead}
      </PageHeading>
      {groups.map((group) => (
        <section key={group.id}>
          <h2 className="mt-12 border-b border-rule pb-3 text-3xl font-semibold">{t.groups[group.id]}</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {group.areas.map((slug) => {
              const inArea = tracks.filter((track) => track.area === slug);
              const ready = inArea.reduce((sum, track) => sum + track.lessons.length, 0);
              const planned = inArea.reduce((sum, track) => sum + track.plan.length, 0);
              return (
                <Link key={slug} href={localePath(lang, `/estantes/${slug}`)} className="group border border-rule bg-parchment-deep p-5 hover:border-gold">
                  <p className="font-mono text-xs text-gold">{fill(t.tracks.ready, { a: ready, b: planned })}</p>
                  <p className="mt-2 text-2xl font-semibold group-hover:text-oxblood">{t.areas[slug][0]}</p>
                  <p className="mt-1 text-ink-soft">{t.areas[slug][1]}</p>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
