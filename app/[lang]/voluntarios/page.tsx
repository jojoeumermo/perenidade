import type { Metadata } from "next";
import { ContentPageView } from "@/components/ContentPageView";
import { loadLang } from "@/i18n";
import { getPage } from "@/lib/content";
import { getHistory } from "@/lib/history";

export async function generateMetadata({ params }: PageProps<"/[lang]/voluntarios">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const page = getPage("voluntarios", lang);
  return { title: page.title, description: page.lead };
}

export default async function Voluntarios({ params }: PageProps<"/[lang]/voluntarios">) {
  const { lang, t } = await loadLang(params);
  // Quem aparece no histórico do acervo, do primeiro ao mais recente, sem repetir.
  const names = [...new Set(getHistory().map((change) => change.author).reverse())];

  return (
    <ContentPageView slug="voluntarios" lang={lang} t={t}>
      <section className="mt-12 border border-rule bg-parchment-deep p-6">
        <h2 className="text-2xl font-semibold">{t.volunteers.contributors}</h2>
        {names.length > 0 ? (
          <>
            <p className="mt-1 font-sans text-sm text-ink-soft">{t.volunteers.contributorsLead}</p>
            <ul className="mt-4 flex flex-wrap gap-2 font-mono text-sm">
              {names.map((name) => (
                <li key={name} className="border border-rule bg-parchment px-3 py-1">{name}</li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-2 font-sans text-sm text-ink-soft">{t.volunteers.none}</p>
        )}
      </section>
    </ContentPageView>
  );
}
