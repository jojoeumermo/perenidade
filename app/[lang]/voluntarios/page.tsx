// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { ContentPageView } from "@/components/ContentPageView";
import { VolunteerForm } from "@/components/VolunteerForm";
import { loadLang } from "@/i18n";
import { getPage } from "@/lib/content";

export async function generateMetadata({ params }: PageProps<"/[lang]/voluntarios">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const page = getPage("voluntarios", lang);
  return { title: page.title, description: page.lead };
}

export default async function Voluntarios({ params }: PageProps<"/[lang]/voluntarios">) {
  const { lang, t } = await loadLang(params);
  return (
    <ContentPageView slug="voluntarios" lang={lang} t={t}>
      <VolunteerForm s={t.volunteer} />
    </ContentPageView>
  );
}
