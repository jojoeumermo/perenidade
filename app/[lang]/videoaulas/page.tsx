// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "@/components/Link";
import { Suspense } from "react";
import { Cartaz } from "@/components/Cartaz";
import { ComoFunciona } from "@/components/ComoFunciona";
import { VideoaulasPublicas } from "@/components/VideoaulasPublicas";
import { loadLang } from "@/i18n";
import { pickSections } from "@/i18n/core";
import { I18nProvider } from "@/components/I18n";
import { paginaMeta } from "@/lib/seo";
import { localePath } from "@/i18n/config";

export async function generateMetadata({ params }: PageProps<"/[lang]/videoaulas">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/videoaulas", t.videoLessons.title, t.videoLessons.lead);
}

// As aulas gravadas pelos educadores do instituto, revisadas pela revisão. A lista vem do serviço, na hora.
export default async function Videoaulas({ params }: PageProps<"/[lang]/videoaulas">) {
  const { lang, t } = await loadLang(params);
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <Cartaz eyebrow={t.videoLessons.eyebrow} title={t.videoLessons.title} tone="vermelho">
        {t.videoLessons.lead}
      </Cartaz>
      <Suspense>
        <I18nProvider lang={lang} t={pickSections(t, ["areas"])}><VideoaulasPublicas s={t.videoLessons} /></I18nProvider>
      </Suspense>
      <ComoFunciona s={t.videoLessons.how} href={localePath(lang, "/voluntarios")} />
      <p className="mt-12 font-sans text-sm">
        <Link href={localePath(lang, "/videos")} className="underline hover:text-oxblood">{t.nav.videos} →</Link>
      </p>
    </div>
  );
}
