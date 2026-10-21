// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { Cartaz } from "@/components/Cartaz";
import { RadioLuciaAoVivo } from "@/components/RadioLuciaAoVivo";
import { RadioPage, type Station } from "@/components/RadioPage";
import stations from "@/content/radios.json";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/radio">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/radio", t.radio.title, t.radio.lead);
}

export default async function Radio({ params }: PageProps<"/[lang]/radio">) {
  const { t } = await loadLang(params);
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Cartaz eyebrow={t.radio.eyebrow} title={t.radio.title} slogan={t.slogans.radio} tone="preto">
        {t.radio.lead}
      </Cartaz>
      <RadioLuciaAoVivo />
      <RadioPage stations={stations as Station[]} />
    </div>
  );
}
