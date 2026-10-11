// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
import type { Metadata } from "next";
import { Mural } from "@/components/Mural";
import { PageHeading } from "@/components/PageHeading";
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
      <PageHeading eyebrow={s.eyebrow} title={s.title}>
        {s.lead}
      </PageHeading>
      <section className="mt-8 border-l-2 border-gold pl-4 font-sans text-sm">
        <h2 className="font-semibold">{s.rulesTitle}</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-soft">
          {s.rules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </section>
      <Mural s={s} />
    </div>
  );
}
