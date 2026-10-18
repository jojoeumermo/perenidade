// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeading } from "@/components/PageHeading";
import { VideoaulasPublicas } from "@/components/VideoaulasPublicas";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";

export async function generateMetadata({ params }: PageProps<"/[lang]/videoaulas">): Promise<Metadata> {
  const { t } = await loadLang(params);
  return { title: t.videoLessons.title, description: t.videoLessons.lead };
}

// As aulas gravadas pelos educadores do instituto, revisadas pela revisão. A lista vem do serviço, na hora.
export default async function Videoaulas({ params }: PageProps<"/[lang]/videoaulas">) {
  const { lang, t } = await loadLang(params);
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <PageHeading eyebrow={t.videoLessons.eyebrow} title={t.videoLessons.title}>
        {t.videoLessons.lead}
      </PageHeading>
      <Suspense>
        <VideoaulasPublicas s={t.videoLessons} />
      </Suspense>
      <p className="mt-12 font-sans text-sm">
        <Link href={localePath(lang, "/videos")} className="underline hover:text-oxblood">{t.nav.videos} →</Link>
      </p>
    </div>
  );
}
