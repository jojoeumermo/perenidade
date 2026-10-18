// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { Cartaz } from "@/components/Cartaz";
import { SupportersWall } from "@/components/SupportersWall";
import { loadLang } from "@/i18n";
import { site } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/[lang]/apoie">): Promise<Metadata> {
  const { t } = await loadLang(params);
  return { title: t.support.title, description: t.support.lead };
}

export default async function Apoie({ params }: PageProps<"/[lang]/apoie">) {
  const { t } = await loadLang(params);
  const s = t.support;
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Cartaz eyebrow={s.eyebrow} title={s.title} slogan={t.slogans.apoie} tone="raios">
        {s.lead}
      </Cartaz>

      <div className="prose-lesson mt-8">
        {s.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        <ul>
          {s.costs.map((cost) => (
            <li key={cost}>{cost}</li>
          ))}
        </ul>
        <p>{s.optional}</p>
      </div>

      <a
        href={site.support}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-8 inline-block bg-oxblood px-8 py-3 font-sans text-sm font-medium text-parchment hover:bg-ink"
      >
        {s.button} ↗
      </a>
      <p className="mt-3 font-sans text-sm text-ink-soft">{s.note}</p>

      <section className="mt-14 border-t border-rule pt-8">
        <h2 className="text-3xl font-semibold">{s.wallTitle}</h2>
        <p className="mt-2 font-sans text-sm text-ink-soft">{s.wallLead}</p>
        <SupportersWall empty={s.wallEmpty} />
      </section>
    </div>
  );
}
