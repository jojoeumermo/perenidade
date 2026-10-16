// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "next/link";
import { InstagramIcon } from "@/components/Footer";
import { LanguageSwitcher } from "@/components/NavLinks";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { site } from "@/lib/site";

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
        [n.live, "/ao-vivo", d.live],
        [n.notebook, "/caderno", d.notebook],
        [n.tutoring, "/reforco", d.tutoring],
        [n.tools, "/ferramentas", d.tools],
        [n.glossary, "/glossario", d.glossary],
        [n.authors, "/autores", d.authors],
        [n.videoLessons, "/videoaulas", d.videoLessons],
        [n.videos, "/videos", d.videos],
        [n.drawer, "/gaveta", d.drawer],
        [n.sources, "/guia", d.sources],
      ],
    ],
    [
      t.more.critical,
      [
        [n.timeline, "/linha-do-tempo", d.timeline],
        [n.gallery, "/galeria", d.gallery],
        [n.factCheck, "/checagens", d.factCheck],
        [n.data, "/dados", d.data],
        [n.debates, "/debates", d.debates],
        [n.fallacies, "/falacias", d.fallacies],
        [n.news, "/noticias", d.news],
        [n.journal, "/jornal", d.journal],
        [n.podcasts, "/podcasts", d.podcasts],
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
      {/* No celular e no tablet o idioma sai da barra de cima e mora aqui. */}
      <label className="mt-6 hidden items-center justify-between gap-4 border-2 border-ink bg-parchment-deep px-4 py-2 font-sans max-lg:flex app:flex [&_select]:max-w-none">
        {t.common.language}
        <LanguageSwitcher wide />
      </label>
      {/* Na tela grande, cartões; no celular, uma lista corrida de linhas largas, como a tela de ajustes do aparelho. */}
      {sections.map(([title, items]) => (
        <section key={title}>
          <h2 className="mt-12 border-b border-rule pb-3 text-3xl font-semibold max-md:mt-7 max-md:border-0 max-md:px-1 max-md:pb-0 max-md:font-mono max-md:text-xs! max-md:font-normal max-md:uppercase max-md:tracking-[0.2em] max-md:text-gold">{title}</h2>
          <div className="mt-6 grid gap-4 max-md:mt-2 max-md:gap-0 max-md:overflow-hidden max-md:border-2 max-md:border-ink max-md:bg-parchment-deep sm:grid-cols-2">
            {items.map(([label, path, description]) => (
              <Link
                key={path}
                href={localePath(lang, path)}
                className="group flex items-center justify-between gap-3 border border-rule bg-parchment-deep p-5 hover:border-gold max-md:border-0 max-md:border-b max-md:bg-transparent max-md:px-4 max-md:py-3 max-md:last:border-b-0"
              >
                <span className="block min-w-0">
                  <span className="block text-2xl font-semibold group-hover:text-oxblood max-md:text-lg max-md:leading-snug">{label}</span>
                  <span className="mt-1 block text-ink-soft max-md:mt-0.5 max-md:line-clamp-2 max-md:font-sans max-md:text-[0.8rem] max-md:leading-snug">{description}</span>
                </span>
                <span aria-hidden className="hidden shrink-0 font-sans text-2xl leading-none text-ink-soft max-md:block">›</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
      {/* O perfil do instituto fora do site: no aplicativo o rodapé some, então ele também mora aqui. */}
      <a
        href={site.instagram}
        target="_blank"
        rel="noopener noreferrer me"
        className="group mt-12 flex items-center gap-4 border-2 border-ink bg-parchment-deep p-5 hover:border-oxblood max-md:mt-7 max-md:px-4 max-md:py-3"
      >
        <InstagramIcon className="h-8 w-8 shrink-0 text-oxblood" />
        <span className="block min-w-0">
          <span className="block text-2xl font-semibold group-hover:text-oxblood max-md:text-lg">
            {t.footer.instagram} <span className="font-mono text-sm font-normal text-ink-soft">@institutoluciaorg ↗</span>
          </span>
          <span className="mt-1 block text-ink-soft max-md:mt-0.5 max-md:font-sans max-md:text-[0.8rem] max-md:leading-snug">{d.instagram}</span>
        </span>
      </a>
    </div>
  );
}
