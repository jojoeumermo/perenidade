// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/NavLinks";
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
        [n.start, "/comecar", d.start],
        [n.questions, "/perguntas", d.questions],
        [n.tutoring, "/reforco", d.tutoring],
        [n.tools, "/ferramentas", d.tools],
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
        [n.gallery, "/galeria", d.gallery],
        [n.factCheck, "/checagens", d.factCheck],
        [n.debates, "/debates", d.debates],
        [n.news, "/noticias", d.news],
        [n.journal, "/jornal", d.journal],
        [n.radio, "/radio", d.radio],
        [n.mural, "/mural", d.mural],
        [n.materials, "/materiais", d.materials],
        [n.memorial, "/memorial", d.memorial],
      ],
    ],
    [
      t.footer.project,
      [
        [n.volunteers, "/voluntarios", d.volunteers],
        [n.contribute, "/contribuir", d.contribute],
        [n.support, "/apoie", d.support],
        [n.about, "/sobre", d.about],
        [n.dedication, "/dedicatoria", d.dedication],
        [n.myData, "/meus-dados", d.myData],
        [n.privacy, "/privacidade", d.privacy],
        [n.terms, "/termos", d.terms],
      ],
    ],
  ];
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <PageHeading eyebrow={t.more.eyebrow} title={t.more.title}>
        {t.more.lead}
      </PageHeading>
      {/* No aplicativo o idioma sai da barra de cima e mora aqui. */}
      <label className="mt-6 hidden items-center justify-between gap-4 border-y border-rule py-3 font-sans app:flex">
        {t.common.language}
        <LanguageSwitcher />
      </label>
      {/* No navegador, cartões; no aplicativo, uma lista corrida de linhas largas, como a tela de ajustes do celular. */}
      {sections.map(([title, items]) => (
        <section key={title}>
          <h2 className="mt-12 border-b border-rule pb-3 text-3xl font-semibold app:max-md:mt-8 app:max-md:border-b-2 app:max-md:border-ink app:max-md:pb-2 app:max-md:text-2xl">{title}</h2>
          <div className="mt-6 grid gap-4 app:max-md:mt-0 app:max-md:gap-0 sm:grid-cols-2">
            {items.map(([label, path, description]) => (
              <Link
                key={path}
                href={localePath(lang, path)}
                className="group flex items-center justify-between gap-3 border border-rule bg-parchment-deep p-5 hover:border-gold app:max-md:border-0 app:max-md:border-b app:max-md:bg-transparent app:max-md:px-1 app:max-md:py-3.5"
              >
                <span className="block min-w-0">
                  <span className="block text-2xl font-semibold group-hover:text-oxblood app:max-md:text-xl">{label}</span>
                  <span className="mt-1 block text-ink-soft app:max-md:mt-0.5 app:max-md:font-sans app:max-md:text-sm">{description}</span>
                </span>
                <span aria-hidden className="hidden shrink-0 font-sans text-2xl leading-none text-ink-soft app:max-md:block">›</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
