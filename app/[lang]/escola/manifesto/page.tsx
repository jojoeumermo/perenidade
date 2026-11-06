// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { CartazDaFrente } from "@/components/escola/frente/CartazDaFrente";
import Link from "@/components/Link";
import { Markdown } from "@/components/Markdown";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { textosDaFrente } from "@/i18n/escola/frente";
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
 * O manifesto da Frente Revolucionária Lúcia (T15): versão inicial, em discussão, marcada assim no alto e no próprio
 * texto. Página pública (PUBLICAS_DA_ESCOLA). O texto é o mesmo nos 6 idiomas (só a moldura é traduzida), e termina
 * no chamado de voluntários militantes.
 */
export default async function Manifesto({ params }: PageProps<"/[lang]/escola/manifesto">) {
  const { lang } = await loadLang(params);
  const f = textosDaFrente(lang);
  const m = f.manifesto;
  return (
    <div className="mx-auto max-w-3xl px-4 pb-12 pt-4" data-manifesto="">
      <p className="mt-2 font-sans text-sm">
        <Link href={localePath(lang, "/escola")} className="text-ink-soft hover:text-oxblood">
          ← {m.voltar}
        </Link>
      </p>
      <CartazDaFrente
        lang={lang}
        s={f.cartaz}
        olho={m.olho}
        titulo={m.titulo}
        chamado={false}
        linha={
          <p className="frente-selo" data-versao-inicial="">
            {m.situacao}
          </p>
        }
      />
      {lang !== "pt" && <p className="mt-6 font-sans text-sm text-ink-soft">{m.emPortugues}</p>}
      <article lang="pt-BR" className="frente-manifesto mt-6 text-lg leading-relaxed">
        <Markdown lang="pt">{lerManifesto()}</Markdown>
      </article>
      <section className="frente-cartaz frente-fecho mt-10" aria-labelledby="manifesto-chamado">
        <div className="frente-corpo">
          <h2 id="manifesto-chamado" className="frente-titulo frente-titulo-menor">
            {m.chamadoTitulo}
          </h2>
          <p className="frente-linha">{m.chamadoTexto}</p>
          <p className="frente-botoes">
            <Link href={localePath(lang, "/escola/militantes")} className="frente-botao frente-botao-amarelo">
              {m.chamadoBotao} →
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
