// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { Markdown } from "@/components/Markdown";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { parseFrontmatter } from "@/lib/frontmatter";
import { textosDaBase } from "@/lib/escola/textos";
import { paginaMeta } from "@/lib/seo";

/** O texto de content/escola/quem-foi-lucia-maria.md, o mesmo nos 6 idiomas (só a moldura é traduzida). */
function lerTexto(): string {
  const { content } = parseFrontmatter(fs.readFileSync(path.join(process.cwd(), "content", "escola", "quem-foi-lucia-maria.md"), "utf8"));
  return content.trim();
}

export async function generateMetadata({ params }: PageProps<"/[lang]/escola/quem-foi-lucia-maria">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const s = textosDaBase(lang);
  return paginaMeta(lang, "/escola/quem-foi-lucia-maria", s.quemFoi.titulo, s.quemFoi.descricao);
}

/**
 * Quem foi Lúcia Maria: a página que a entrada da Escola abre primeiro. O texto é o que a coordenação mandar
 * (docs/ESCOLA.md); até lá, o arquivo tem só o marcador. Nada é escrito aqui sobre ela, nem foto, e esta página não se
 * mistura com /dedicatoria (que fala do nome "Lúcia" do instituto).
 */
export default async function QuemFoiLuciaMaria({ params }: PageProps<"/[lang]/escola/quem-foi-lucia-maria">) {
  const { lang } = await loadLang(params);
  const s = textosDaBase(lang);
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <PageHeading eyebrow={s.quemFoi.olho} title={s.quemFoi.titulo} voltar={{ href: localePath(lang, "/escola"), texto: s.nav.entrada }} />
      {lang !== "pt" && <p className="mt-6 font-sans text-sm text-ink-soft">{s.quemFoi.emPortugues}</p>}
      <article lang="pt-BR" data-quem-foi-lucia-maria="" className="mt-6 text-xl leading-relaxed">
        <Markdown lang="pt">{lerTexto()}</Markdown>
      </article>
    </div>
  );
}
