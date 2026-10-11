// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";

export async function generateMetadata({ params }: PageProps<"/[lang]/explorar">): Promise<Metadata> {
  const { t } = await loadLang(params);
  return { title: t.more.title, description: t.more.lead };
}

// Tudo o que não cabe no menu do topo, em um só lugar, para o menu continuar curto.
export default async function Explorar({ params }: PageProps<"/[lang]/explorar">) {
  const { lang, t } = await loadLang(params);
  const n = t.nav;
  const d = t.more.items as Record<string, string>;
  const sections: [string, [string, string, string][]][] = [
    [
      t.footer.learn,
      [
        [n.tools, "/ferramentas", d.tools],
        [n.questions, "/perguntas", d.questions],
        [n.glossary, "/glossario", d.glossary],
        [n.authors, "/autores", d.authors],
        [n.videos, "/videos", d.videos],
        [n.sources, "/guia", d.sources],
      ],
    ],
    [
      t.more.critical,
      [
        [n.timeline, "/linha-do-tempo", d.timeline],
        [n.factCheck, "/checagens", d.factCheck],
        [n.debates, "/debates", d.debates],
        [n.radio, "/radio", d.radio],
        [n.mural, "/mural", d.mural],
      ],
    ],
    [
      t.footer.project,
      [
        [n.volunteers, "/voluntarios", d.volunteers],
        [n.about, "/sobre", d.about],
        [n.history, "/historico", d.history],
        [n.myData, "/meus-dados", d.myData],
      ],
    ],
  ];
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <PageHeading eyebrow={t.more.eyebrow} title={t.more.title}>
        {t.more.lead}
      </PageHeading>
      {sections.map(([title, items]) => (
        <section key={title}>
          <h2 className="mt-12 border-b border-rule pb-3 text-3xl font-semibold">{title}</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {items.map(([label, path, description]) => (
              <Link key={path} href={localePath(lang, path)} className="group border border-rule bg-parchment-deep p-5 hover:border-gold">
                <p className="text-2xl font-semibold group-hover:text-oxblood">{label}</p>
                <p className="mt-1 text-ink-soft">{description}</p>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
