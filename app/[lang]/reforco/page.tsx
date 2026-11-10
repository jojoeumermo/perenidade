// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { Cartaz } from "@/components/Cartaz";
import { Tutoring } from "@/components/Tutoring";
import { loadLang } from "@/i18n";
import { pickSections } from "@/i18n/core";
import { I18nProvider } from "@/components/I18n";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/reforco">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/reforco", t.tutoring.title, t.tutoring.description);
}

// Aula de reforço: quem travou em uma matéria escreve a dúvida e recebe a explicação por e-mail.
export default async function Reforco({ params }: PageProps<"/[lang]/reforco">) {
  const { lang, t } = await loadLang(params);
  const s = t.tutoring;
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Cartaz eyebrow={s.eyebrow} title={s.title} tone="vermelho">
        {s.lead}
      </Cartaz>
      <ol className="mt-6 list-decimal space-y-1 pl-5 font-sans text-sm text-ink-soft">
        {s.how.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <I18nProvider lang={lang} t={pickSections(t, ["areas"])}><Tutoring s={s} /></I18nProvider>
    </div>
  );
}
