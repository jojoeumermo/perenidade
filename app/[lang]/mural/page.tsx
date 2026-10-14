// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { Mural } from "@/components/Mural";
import { Cartaz } from "@/components/Cartaz";
import { loadLang } from "@/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/mural">): Promise<Metadata> {
  const { t } = await loadLang(params);
  return { title: t.mural.title, description: t.mural.description };
}

// Economia solidária: quem vive do próprio trabalho divulga o que faz, sem intermediário e sem pagar nada.
export default async function MuralPage({ params }: PageProps<"/[lang]/mural">) {
  const { t } = await loadLang(params);
  const s = t.mural;
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <Cartaz eyebrow={s.eyebrow} title={s.title} slogan={t.footer.slogan} tone="raios">
        {s.lead}
      </Cartaz>
      <section className="mt-8 border-2 border-ink font-sans text-sm">
        <h2 className="jornal-preto px-4 py-2 font-black uppercase italic tracking-tight">{s.rulesTitle}</h2>
        <ul className="list-disc space-y-1 py-3 pr-4 pl-9 text-ink-soft">
          {s.rules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </section>
      <Mural s={s} />
    </div>
  );
}
