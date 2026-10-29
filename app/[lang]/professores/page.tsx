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

/** O guia em partes: a abertura (antes do primeiro "## ") e cada seção, com o título separado do texto. */
function secoesDoGuia(corpo: string): { abertura: string; secoes: { titulo: string; texto: string }[] } {
  const [abertura, ...resto] = corpo.split(/\n(?=## )/);
  const temAbertura = !abertura.startsWith("## ");
  const blocos = temAbertura ? resto : [abertura, ...resto];
  return {
    abertura: temAbertura ? abertura.trim() : "",
    secoes: blocos.map((bloco) => {
      const [linha, ...texto] = bloco.split("\n");
      return { titulo: linha.replace(/^##\s+/, "").trim(), texto: texto.join("\n").trim() };
    }),
  };
}

/**
 * Para professores (recurso "professores"): o guia de uso em sala, cada seção num cartão, e os planos de aula em fichas.
 * Desligado, a página não existe.
 */
export default async function Page({ params }: PageProps<"/[lang]/professores">) {
  if (!ligado("professores")) notFound();
  const { lang, t } = await loadLang(params);
  const { s } = textosDoEstudo(lang);
  const guia = guiaDoProfessor();
  const planos = planosDeAula();
  const to = (caminho: string) => localePath(lang, caminho);
  const { abertura, secoes } = secoesDoGuia(guia.corpo);
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
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
      <div lang="pt-BR">
        {abertura && (
          <div className="mt-8 max-w-3xl">
            <Markdown lang={lang}>{abertura}</Markdown>
          </div>
        )}
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {secoes.map((secao, i) => (
            <section key={secao.titulo} aria-label={secao.titulo} className={`${i % 3 === 1 ? "cartao-v" : "cartao"} p-6 sm:p-7`}>
              <p className="font-mono text-xs text-prelo-texto">{String(i + 1).padStart(2, "0")}</p>
              <h2 className="mt-1 font-serif text-[1.55rem] font-semibold leading-tight">{secao.titulo}</h2>
              <div className="mt-3">
                <Markdown lang={lang}>{secao.texto}</Markdown>
              </div>
            </section>
          ))}
        </div>
      </div>
      <section id="planos" aria-labelledby="planos-titulo" className="mt-14 scroll-mt-24">
        <h2 id="planos-titulo" className="border-b-[3px] border-double border-ink pb-2 font-serif text-[1.9rem] font-semibold leading-tight">
          {s.professores.planos}
        </h2>
        <ul className="mt-6 grid gap-5 font-sans text-sm sm:grid-cols-2 lg:grid-cols-3">
          {planos.map((p) => (
            <li key={p.slug} className="cartao flex flex-col p-5" lang="pt-BR">
              <Link href={to(`/professores/${p.slug}`)} className="font-serif text-xl font-semibold leading-snug underline decoration-rule underline-offset-4 hover:text-oxblood hover:decoration-[#c21f16]">
                {p.titulo}
              </Link>
              <p className="mt-2 leading-relaxed text-ink-soft">{p.resumo}</p>
              <p className="mt-auto flex flex-wrap gap-2 pt-4 font-mono text-[0.7rem]">
                <span className="border border-ink px-2 py-0.5">{p.duracao}</span>
                <span className="border border-ink px-2 py-0.5">{p.publico}</span>
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
