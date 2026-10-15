// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { areaSlugs } from "@/lib/areas";
import { getVideos } from "@/lib/content";

export async function generateMetadata({ params }: PageProps<"/[lang]/videos">): Promise<Metadata> {
  const { t } = await loadLang(params);
  return { title: t.videos.title, description: t.videos.lead };
}

// Os vídeos não ficam hospedados aqui: cada item leva ao canal de quem produziu.
export default async function Videos({ params }: PageProps<"/[lang]/videos">) {
  const { lang, t } = await loadLang(params);
  const videos = getVideos(lang);
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <PageHeading eyebrow={t.videos.eyebrow} title={t.videos.title}>
        {t.videos.lead}
      </PageHeading>
      <p className="mt-6 border-l-2 border-gold pl-4 font-sans">
        <Link href={localePath(lang, "/videoaulas")} className="underline hover:text-oxblood">{t.videos.own}</Link>
      </p>
      {areaSlugs.map((area) => {
        const inArea = videos.filter((video) => video.area === area);
        if (inArea.length === 0) return null;
        return (
          <section key={area}>
            <h2 className="mt-12 border-b border-rule pb-3 text-3xl font-semibold">{t.areas[area][0]}</h2>
            <ul className="mt-6 grid gap-4 font-sans text-sm md:grid-cols-2">
              {inArea.map((video) => (
                <li key={video.slug} className="border border-rule bg-parchment-deep p-5">
                  <p className="font-mono text-xs text-gold">{video.channel} · {video.language}</p>
                  <a href={video.url} target="_blank" rel="noopener noreferrer" className="mt-1 block font-serif text-xl font-semibold hover:text-oxblood">{video.title} ↗</a>
                  <p className="mt-1 text-ink-soft" lang="pt-BR">{video.description}</p>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
