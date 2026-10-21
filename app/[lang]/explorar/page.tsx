// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { ExplorarCartoes, type SecaoDoExplorar } from "@/components/ExplorarCartoes";
import { InstagramIcon } from "@/components/Footer";
import { LanguageSwitcher } from "@/components/NavLinks";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { ligado } from "@/lib/recursos";
import { paginaMeta } from "@/lib/seo";
import { site } from "@/lib/site";
import { textosDoEstudo } from "@/lib/textos-estudo";

export async function generateMetadata({ params }: PageProps<"/[lang]/explorar">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/explorar", t.more.title, t.more.lead);
}

// Tudo o que não cabe no menu do topo, em um só lugar, para o menu continuar curto.
export default async function Explorar({ params }: PageProps<"/[lang]/explorar">) {
  const { lang, t } = await loadLang(params);
  const n = t.nav;
  // Recursos novos (lib/recursos.ts): só entram na lista quando ligados.
  const novos = textosDoEstudo(lang).s;
  const d = t.more.items as Record<string, string>;
  const sections: SecaoDoExplorar[] = [
    {
      title: t.lists.study,
      items: [
        [n.disciplines, "/trilhas", t.tracks.lead],
        [n.start, "/comecar", d.start],
        [n.questions, "/perguntas", d.questions],
        [n.library, "/acervo", t.library.lead],
        [n.live, "/ao-vivo", d.live],
        [n.videoLessons, "/videoaulas", d.videoLessons],
        [n.videos, "/videos", d.videos],
        [n.notebook, "/caderno", d.notebook],
        ...(ligado("meu-estudo") ? [[novos.meuEstudo.titulo, "/meu-estudo", novos.meuEstudo.descricao] as [string, string, string]] : []),
        ...(ligado("nivelamento") ? [[novos.nivelamento.titulo, "/nivelamento", novos.nivelamento.descricao] as [string, string, string]] : []),
        ...(ligado("turma") ? [[novos.turma.titulo, "/turma", novos.turma.descricao] as [string, string, string]] : []),
        ...(ligado("professores") ? [[novos.professores.titulo, "/professores", novos.professores.descricao] as [string, string, string]] : []),
        ...(ligado("guia-contribuir") ? [[novos.guia.titulo, "/contribuir/guia", novos.guia.descricao] as [string, string, string]] : []),
        [n.tutoring, "/reforco", d.tutoring],
        [n.tools, "/ferramentas", d.tools],
        [n.labs, "/laboratorios", t.labs.lead],
        [n.freeRoom, "/sala-livre", d.freeRoom],
        [n.questionBank, "/questoes", t.lists.bankLead],
        [n.glossary, "/glossario", d.glossary],
        [n.authors, "/autores", d.authors],
        [n.sources, "/guia", d.sources],
        [n.drawer, "/gaveta", d.drawer],
      ].map(([label, path, description]) => ({ label, path, description })),
    },
    {
      title: t.lists.inform,
      items: [
        [n.journal, "/jornal", d.journal],
        [n.news, "/noticias", d.news],
        [n.podcasts, "/podcasts", d.podcasts],
        [n.radio, "/radio", d.radio],
        [n.factCheck, "/checagens", d.factCheck],
        [n.fallacies, "/falacias", d.fallacies],
        [n.debates, "/debates", d.debates],
        [n.data, "/dados", d.data],
        [n.timeline, "/linha-do-tempo", d.timeline],
        [n.gallery, "/galeria", d.gallery],
        [n.memorial, "/memorial", d.memorial],
        [n.materials, "/materiais", d.materials],
        [n.mural, "/mural", d.mural],
        [n.community, "/comunidade", d.community ?? n.community],
        [n.health, "/saude", d.health],
        [n.reportBug, "/relatar-erro", d.bugs],
      ].map(([label, path, description]) => ({ label, path, description })),
    },
    {
      title: t.lists.help,
      items: [
        [n.volunteers, "/voluntarios", d.volunteers],
        [n.contribute, "/contribuir", d.contribute],
        [n.support, "/apoie", d.support],
      ].map(([label, path, description]) => ({ label, path, description })),
    },
    {
      title: t.lists.about,
      items: [
        [n.about, "/sobre", d.about],
        [n.team, "/quem-somos", d.team ?? n.team],
        [n.dedication, "/dedicatoria", d.dedication],
        [n.myData, "/meus-dados", d.myData],
        [n.privacy, "/privacidade", d.privacy],
        [n.terms, "/termos", d.terms],
      ].map(([label, path, description]) => ({ label, path, description })),
    },
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
