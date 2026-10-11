// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { PageHeading } from "@/components/PageHeading";
import { Tutoring } from "@/components/Tutoring";
import { loadLang } from "@/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/reforco">): Promise<Metadata> {
  const { t } = await loadLang(params);
  return { title: t.tutoring.title, description: t.tutoring.description };
}

// Aula de reforço: quem travou em uma matéria escreve a dúvida e recebe a explicação por e-mail.
export default async function Reforco({ params }: PageProps<"/[lang]/reforco">) {
  const { t } = await loadLang(params);
  const s = t.tutoring;
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <PageHeading eyebrow={s.eyebrow} title={s.title}>
        {s.lead}
      </PageHeading>
      <ol className="mt-6 list-decimal space-y-1 pl-5 font-sans text-sm text-ink-soft">
        {s.how.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <Tutoring s={s} />
    </div>
  );
}
