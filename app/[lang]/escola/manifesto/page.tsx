// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import Link from "@/components/Link";
import { Markdown } from "@/components/Markdown";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { textosDaBiblioteca } from "@/i18n/escola/biblioteca";
import { textosDaFormacaoBase } from "@/i18n/escola/formacao-base";
import { textosDaFrente } from "@/i18n/escola/frente";
import "@/components/escola/biblioteca/escola-f6.css";
import { parseFrontmatter } from "@/lib/frontmatter";
import { paginaMeta } from "@/lib/seo";

/** O manifesto de content/escola/manifesto.md (o mesmo de docs/escola-revolucionaria/MANIFESTO.md), em português. */
function lerManifesto(): string {
  return parseFrontmatter(fs.readFileSync(path.join(process.cwd(), "content", "escola", "manifesto.md"), "utf8")).content.trim();
}

export async function generateMetadata({ params }: PageProps<"/[lang]/escola/manifesto">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const m = textosDaFrente(lang).manifesto;
  return paginaMeta(lang, "/escola/manifesto", m.metaTitulo, m.metaDescricao);
}

/**
 * O manifesto único do Instituto Lúcia e da Frente Revolucionária Lúcia (o mesmo texto de /sobre, antes de "O
 * combinado"), no desenho da Escola (09/11/2026): o cartaz vermelho arredondado das telas novas (o mesmo da tela A
 * Frente), o texto no escuro com as letras da Escola e o chamado no fim. O cartaz quadrado com a estrela saiu.
 * Página pública (PUBLICAS_DA_ESCOLA): quem não é militante a lê na moldura da porta; o texto é o mesmo nos 6 idiomas.
 */
export default async function Manifesto({ params }: PageProps<"/[lang]/escola/manifesto">) {
  const { lang } = await loadLang(params);
  const m = textosDaFrente(lang).manifesto;
  const base = textosDaFormacaoBase(lang);
  const quemFoi = textosDaBiblioteca(lang).frente.quemFoi;
  return (
    <div className="ef6-tela ef-manifesto" data-escola-escura="" data-manifesto="">
      <section aria-labelledby="ef-manifesto-titulo" className="ef6-cartaz">
        <div className="ef6-cartaz-texto">
          <span className="ef-t ef6-cartaz-olho">{m.olho}</span>
          <h1 id="ef-manifesto-titulo" className="ef-t">
            {m.titulo}
          </h1>
          <p className="ef-manifesto-lema">{base.porta.lema}</p>
        </div>
        <div className="ef6-cartaz-acoes">
          <Link href={localePath(lang, "/escola/militantes")} className="ef6-cheio">
            {m.chamadoBotao}
          </Link>
          <Link href={localePath(lang, "/escola/quem-foi-lucia-maria")} className="ef6-vazado">
            {quemFoi}
          </Link>
        </div>
      </section>
      <p className="ef-manifesto-situacao" data-versao-inicial="">
        {m.situacao}
        {lang !== "pt" && ` · ${m.emPortugues}`}
      </p>
      <article lang="pt-BR" className="ef-manifesto-texto">
        <Markdown lang="pt">{lerManifesto()}</Markdown>
      </article>
      <section aria-labelledby="ef-manifesto-chamado" className="ef6-cartaz ef-manifesto-fim">
        <div className="ef6-cartaz-texto">
          <h2 id="ef-manifesto-chamado" className="ef-t">
            {m.chamadoTitulo}
          </h2>
          <p className="ef-manifesto-lema">{m.chamadoTexto}</p>
        </div>
        <div className="ef6-cartaz-acoes">
          <Link href={localePath(lang, "/escola/militantes")} className="ef6-cheio">
            {m.chamadoBotao} →
          </Link>
        </div>
      </section>
    </div>
  );
}
