// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { Cartaz } from "@/components/Cartaz";
import { SupportersWall } from "@/components/SupportersWall";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";
import { site } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/[lang]/apoie/anterior">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/apoie/anterior", t.support.title, t.support.lead);
}

/** A versão anterior da página de Apoie, guardada como reserva enquanto a nova é conferida (fora dos buscadores). */
export default async function ApoieAnterior({ params }: PageProps<"/[lang]/apoie/anterior">) {
  const { t } = await loadLang(params);
  const s = t.support;
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="mb-6 border-2 border-gold p-3 font-sans text-sm">{s.page.previous}</p>
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
