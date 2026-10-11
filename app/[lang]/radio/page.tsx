// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
import type { Metadata } from "next";
import { PageHeading } from "@/components/PageHeading";
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
      <PageHeading eyebrow={t.radio.eyebrow} title={t.radio.title}>
        {t.radio.lead}
      </PageHeading>
      <RadioPage stations={stations as Station[]} />
    </div>
  );
}
