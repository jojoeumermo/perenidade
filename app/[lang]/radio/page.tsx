// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { Cartaz } from "@/components/Cartaz";
import { RadioPage, type Station } from "@/components/RadioPage";
import stations from "@/content/radios.json";
import { loadLang } from "@/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/radio">): Promise<Metadata> {
  const { t } = await loadLang(params);
  return { title: t.radio.title, description: t.radio.lead, robots: { index: false } };
}

export default async function Radio({ params }: PageProps<"/[lang]/radio">) {
  const { t } = await loadLang(params);
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Cartaz eyebrow={t.radio.eyebrow} title={t.radio.title} slogan={t.footer.slogan} tone="preto">
        {t.radio.lead}
      </Cartaz>
      <RadioPage stations={stations as Station[]} />
    </div>
  );
}
