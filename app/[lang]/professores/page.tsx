// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "@/components/Link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/Markdown";
import { PageHeading } from "@/components/PageHeading";
import { Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { guiaDoProfessor, planosDeAula } from "@/lib/curriculo-conteudo";
import { ligado } from "@/lib/recursos";
import { paginaMeta } from "@/lib/seo";
import { textosDoEstudo } from "@/lib/textos-estudo";

export async function generateMetadata({ params }: PageProps<"/[lang]/professores">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const { s } = textosDoEstudo(lang);
  return paginaMeta(lang, "/professores", s.professores.titulo, s.professores.descricao);
}

/** Para professores (recurso "professores"): o guia de uso em sala e os planos de aula. Desligado, a página não existe. */
export default async function Page({ params }: PageProps<"/[lang]/professores">) {
  if (!ligado("professores")) notFound();
  const { lang, t } = await loadLang(params);
  const { s } = textosDoEstudo(lang);
  const guia = guiaDoProfessor();
  const planos = planosDeAula();
  const to = (caminho: string) => localePath(lang, caminho);
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <PageHeading eyebrow={s.professores.olho} title={guia.titulo}>
        {guia.resumo}
      </PageHeading>
      {/* O guia e os planos são escritos em português; nos outros idiomas aparecem assim, com o aviso. */}
      <Untranslated lang={lang} t={t} show={lang !== "pt"} />
      <nav aria-label={s.professores.atalhos} className="mt-8 flex flex-wrap gap-3 font-sans text-sm">
        {ligado("turma") && (
          <Link href={to("/turma")} className="bg-ink px-4 py-2 font-semibold text-parchment hover:bg-oxblood">
            {s.professores.montarTurma}
          </Link>
        )}
        {ligado("mapa-curricular") && (
          <Link href={to("/professores/mapa")} className="border-2 border-ink px-4 py-1.5 font-semibold hover:border-oxblood hover:text-oxblood">
            {s.professores.verMapa}
          </Link>
        )}
        <a href="#planos" className="border-2 border-ink px-4 py-1.5 font-semibold hover:border-oxblood hover:text-oxblood">
          {s.professores.verPlanos}
        </a>
      </nav>
      <div className="mt-8" lang="pt-BR">
        <Markdown lang={lang}>{guia.corpo}</Markdown>
      </div>
      <section id="planos" aria-labelledby="planos-titulo" className="mt-12 border-t border-rule pt-6">
        <h2 id="planos-titulo" className="text-3xl font-semibold">
          {s.professores.planos}
        </h2>
        <ul className="mt-4 space-y-4 font-sans text-sm">
          {planos.map((p) => (
            <li key={p.slug} className="border border-rule bg-parchment-deep p-4" lang="pt-BR">
              <Link href={to(`/professores/${p.slug}`)} className="font-serif text-xl font-semibold underline hover:text-oxblood">
                {p.titulo}
              </Link>
              <p className="mt-1 text-ink-soft">{p.resumo}</p>
              <p className="mt-1 font-mono text-xs text-ink-soft">
                {p.duracao} · {p.publico}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
