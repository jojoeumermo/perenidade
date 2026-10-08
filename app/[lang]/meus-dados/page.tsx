// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
import type { Metadata } from "next";
import { DataPanel } from "@/components/DataPanel";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";

export async function generateMetadata({ params }: PageProps<"/[lang]/meus-dados">): Promise<Metadata> {
  const { t } = await loadLang(params);
  return { title: t.data.title, description: t.data.description };
}

export default async function MeusDados({ params }: PageProps<"/[lang]/meus-dados">) {
  const { lang, t } = await loadLang(params);
  const d = t.data;
  const blocks = [
    [d.trackingTitle, d.tracking],
    [d.panicTitle, d.panic],
  ];
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <PageHeading eyebrow={d.eyebrow} title={d.title}>
        {d.lead}
      </PageHeading>
      <DataPanel s={d} />
      <div className="mt-10 grid gap-6 font-sans text-sm sm:grid-cols-2">
        {blocks.map(([title, description]) => (
          <div key={title} className="border-l-2 border-gold pl-4">
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-1 text-ink-soft">{description}</p>
          </div>
        ))}
      </div>
      <section className="mt-10 border-t border-rule pt-6 font-sans text-sm">
        <h2 className="font-serif text-2xl font-semibold">{d.dumpTitle}</h2>
        <p className="mt-2 text-ink-soft">{d.dump}</p>
        <a href={localePath(lang, "/indice.json")} download="instituto-lucia-acervo.json" className="mt-3 inline-block underline hover:text-oxblood">
          {d.dumpLink}
        </a>
        <p className="mt-4 text-ink-soft">{d.textHint}</p>
      </section>
    </div>
  );
}
