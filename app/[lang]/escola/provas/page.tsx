// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { SemanaDeProvas } from "@/components/escola/avaliacao/SemanaDeProvas";
import Link from "@/components/Link";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { htmlLang, localePath } from "@/i18n/config";
import { textosDaAvaliacao } from "@/i18n/escola/avaliacao";
import { trilhasDoCurso } from "@/lib/escola/avaliacao-servidor";
import { carregarCursos } from "@/lib/escola/cursos-servidor";
import { textosDaBase } from "@/lib/escola/textos";
import { paginaMeta } from "@/lib/seo";
import { site } from "@/lib/site";
import "@/styles/escola-avaliacao.css";

export async function generateMetadata({ params }: PageProps<"/[lang]/escola/provas">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const s = textosDaAvaliacao(lang).semana;
  return paginaMeta(lang, "/escola/provas", `${s.titulo} · ${textosDaBase(lang).meta.titulo}`, s.lead);
}

/**
 * A semana de provas solidária da Escola (E4-13, D1-8; docs/escola/avaliacao.md). A data e as provas de cada pessoa
 * são lidas no aparelho (SemanaDeProvas); aqui ficam o que é igual para todo mundo: o jeito solidário e o "estudar
 * junto antes".
 */
export default async function Page({ params }: PageProps<"/[lang]/escola/provas">) {
  const { lang } = await loadLang(params);
  const s = textosDaAvaliacao(lang).semana;
  const cursos = carregarCursos().map((c) => ({ slug: c.slug, titulo: c.titulo, trilhas: trilhasDoCurso(c).map(({ slug, titulo, prova }) => ({ slug, titulo, prova })) }));
  return (
    <div className="mx-auto max-w-4xl px-4 py-12" data-pagina-provas="">
      <PageHeading eyebrow={s.olho} title={s.titulo} voltar={{ href: localePath(lang, "/escola"), texto: textosDaBase(lang).nav.entrada }}>
        <span>{s.lead}</span>
      </PageHeading>

      <SemanaDeProvas cursos={cursos} idioma={htmlLang[lang]} endereco={`${site.url}${localePath(lang, "/escola/provas")}`} s={s} />

      <section className="mt-10 font-sans" aria-labelledby="semana-solidaria">
        <h2 id="semana-solidaria" className="font-serif text-2xl font-semibold">
          {s.solidariaTitulo}
        </h2>
        <ul className="lista-solidaria">
          {s.solidaria.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="mt-10 border-t-2 border-ink pt-4 font-sans" aria-labelledby="estudar-junto">
        <h2 id="estudar-junto" className="font-serif text-2xl font-semibold">
          {s.estudarJuntoTitulo}
        </h2>
        <p className="mt-1">{s.estudarJuntoTexto}</p>
        <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
          <li>
            <Link href={localePath(lang, "/estudo-em-grupo")} className="font-semibold underline hover:text-oxblood">
              {s.grupo} →
            </Link>
          </li>
          <li>
            <Link href={localePath(lang, "/escola/turmas")} className="font-semibold underline hover:text-oxblood">
              {s.turmas} →
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
