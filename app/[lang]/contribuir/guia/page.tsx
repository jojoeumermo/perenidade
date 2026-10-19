// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/Markdown";
import { PageHeading } from "@/components/PageHeading";
import { Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { parseFrontmatter } from "@/lib/frontmatter";
import { ligado } from "@/lib/recursos";
import { paginaMeta } from "@/lib/seo";
import { textosDoEstudo } from "@/lib/textos-estudo";

const ler = (arquivo: string) => fs.readFileSync(path.join(process.cwd(), arquivo), "utf8");

/** O documento sem o título (#) do topo, que vem desta página, e com os subtítulos um nível abaixo (## vira ###). */
const semTitulo = (texto: string) => texto.replace(/^#\s+.+\n+/, "").replace(/^(#{2,5}) /gm, "#$1 ");

export async function generateMetadata({ params }: PageProps<"/[lang]/contribuir/guia">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const { s } = textosDoEstudo(lang);
  return paginaMeta(lang, "/contribuir/guia", s.guia.titulo, s.guia.descricao);
}

/**
 * Guia de contribuição (recurso "guia-contribuir"): as cinco formas de ajudar e o caminho de uma contribuição
 * (content/contribuir/guia.md), mais o modelo de aula e o checklist de revisão, lidos dos próprios documentos de
 * docs/ para nunca haver duas versões. Desligado, a página não existe.
 */
export default async function Page({ params }: PageProps<"/[lang]/contribuir/guia">) {
  if (!ligado("guia-contribuir")) notFound();
  const { lang, t } = await loadLang(params);
  const { s } = textosDoEstudo(lang);
  const guia = parseFrontmatter(ler("content/contribuir/guia.md"));
  const titulo = typeof guia.data.titulo === "string" ? guia.data.titulo : s.guia.titulo;
  const resumo = typeof guia.data.resumo === "string" ? guia.data.resumo : s.guia.descricao;
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <PageHeading eyebrow={s.guia.olho} title={titulo}>
        {resumo}
      </PageHeading>
      <Untranslated lang={lang} t={t} show={lang !== "pt"} />
      <nav aria-label={s.guia.nestaPagina} className="mt-6 flex flex-wrap gap-x-5 gap-y-1 font-sans text-sm">
        <a href="#modelo" className="underline hover:text-oxblood">
          {s.guia.modelo}
        </a>
        <a href="#revisar" className="underline hover:text-oxblood">
          {s.guia.checklist}
        </a>
      </nav>
      <div className="mt-8" lang="pt-BR">
        <Markdown lang={lang}>{guia.content}</Markdown>
      </div>
      <section id="modelo" aria-labelledby="guia-modelo" className="mt-12 border-t border-rule pt-6" lang="pt-BR">
        <h2 id="guia-modelo" className="text-3xl font-semibold">
          {s.guia.modelo}
        </h2>
        <div className="mt-4">
          <Markdown lang={lang}>{semTitulo(ler("docs/MODELO-DE-AULA.md"))}</Markdown>
        </div>
      </section>
      <section id="revisar" aria-labelledby="guia-revisar" className="mt-12 border-t border-rule pt-6" lang="pt-BR">
        <h2 id="guia-revisar" className="text-3xl font-semibold">
          {s.guia.checklist}
        </h2>
        <div className="mt-4">
          <Markdown lang={lang}>{semTitulo(ler("docs/CHECKLIST-DE-REVISAO.md"))}</Markdown>
        </div>
      </section>
    </div>
  );
}
