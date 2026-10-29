// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "@/components/Link";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";
import { localePath } from "@/i18n/config";
import { groups } from "@/lib/areas";
import { VideosDaCuradoria } from "@/components/VideosDaCuradoria";
import { getVideos } from "@/lib/content";

export async function generateMetadata({ params }: PageProps<"/[lang]/videos">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/videos", t.videos.title, t.videos.lead);
}

// Os vídeos não ficam hospedados aqui: cada item leva ao canal de quem produziu.
export default async function Videos({ params }: PageProps<"/[lang]/videos">) {
  const { lang, t } = await loadLang(params);
  const videos = getVideos(lang);
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <PageHeading eyebrow={t.videos.eyebrow} title={t.videos.title}>
        {t.videos.lead}
      </PageHeading>
      <p className="mt-6 border-l-2 border-gold pl-4 font-sans">
        <Link href={localePath(lang, "/videoaulas")} className="underline hover:text-oxblood">{t.videos.own}</Link>
      </p>
      <VideosDaCuradoria
        todos={t.videos.all}
        grupos={groups.map((group) => ({ id: group.id, nome: t.groups[group.id].split(":")[0] }))}
        canais={groups.flatMap((group) =>
          (group.areas as readonly string[]).flatMap((area) =>
            videos
              .filter((video) => video.area === area)
              .map((video) => ({ slug: video.slug, title: video.title, channel: video.channel, url: video.url, area: t.areas[video.area][0], grupo: group.id, language: video.language, description: video.description })),
          ),
        )}
      />
    </div>
  );
}
