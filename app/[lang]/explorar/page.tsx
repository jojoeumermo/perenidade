// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { ExplorarCartoes, type SecaoDoExplorar } from "@/components/ExplorarCartoes";
import { InstagramIcon } from "@/components/Footer";
import { LanguageSwitcher } from "@/components/NavLinks";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";
import { site } from "@/lib/site";
import { secoesDoSite } from "@/lib/secoes-do-site";

export async function generateMetadata({ params }: PageProps<"/[lang]/explorar">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/explorar", t.more.title, t.more.lead);
}

// Tudo o que não cabe no menu do topo, em um só lugar, para o menu continuar curto.
export default async function Explorar({ params }: PageProps<"/[lang]/explorar">) {
  const { lang, t } = await loadLang(params);
  const d = t.more.items as Record<string, string>;
  const sections: SecaoDoExplorar[] = secoesDoSite(lang, t);
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
      <ExplorarCartoes sections={sections} />
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
