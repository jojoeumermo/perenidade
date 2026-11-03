// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { type CartaoDoCurso, CatalogoDeCursos } from "@/components/escola/cursos/CatalogoDeCursos";
import Link from "@/components/Link";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { htmlLang, localePath } from "@/i18n/config";
import { textosDosCursos } from "@/i18n/escola/cursos";
import { groups } from "@/lib/areas";
import { carregarCursos } from "@/lib/escola/cursos-servidor";
import { patronoDo, verCurso } from "@/lib/escola/cursos-vista";
import { paginaMeta } from "@/lib/seo";
import "@/styles/escola-cursos.css";

export async function generateMetadata({ params }: PageProps<"/[lang]/escola/cursos">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const s = textosDosCursos(lang);
  return paginaMeta(lang, "/escola/cursos", s.meta.catalogoTitulo, s.meta.catalogoDescricao);
}

const grupoDa = (area: string) => groups.find((g) => (g.areas as readonly string[]).includes(area))?.id ?? "";

/** O catálogo dos cursos da Escola Lúcia Maria (E4-07): por ciclo, com filtros, horas, aulas, formato e patrono. */
export default async function Cursos({ params }: PageProps<"/[lang]/escola/cursos">) {
  const { lang, t } = await loadLang(params);
  const s = textosDosCursos(lang);
  const cursos = carregarCursos();
  const titulo = new Map(cursos.map((c) => [c.slug, c.titulo]));
  const horas = new Intl.NumberFormat(htmlLang[lang], { maximumFractionDigits: 1 });
  const cartoes: CartaoDoCurso[] = cursos.map((curso) => {
    const visto = verCurso(curso);
    return {
      slug: curso.slug,
      titulo: curso.titulo,
      resumo: curso.resumo,
      ciclo: curso.ciclo,
      formato: curso.formato,
      grupo: grupoDa(curso.area),
      objetivos: curso.objetivos,
      horas: horas.format(visto.horas),
      semanas: curso.semanas,
      nAulas: visto.nAulas,
      ...(patronoDo(curso) ? { patrono: patronoDo(curso)!.nome } : {}),
      requisitos: curso.requisitos.map((r) => titulo.get(r) ?? r),
    };
  });
  // "Aprender a estudar" primeiro no básico: é o recomendado antes de qualquer curso longo.
  cartoes.sort((a, b) => Number(b.slug === "aprender-a-estudar") - Number(a.slug === "aprender-a-estudar"));
  const usados = new Set(cartoes.map((k) => k.grupo));
  const grupos = groups.filter((g) => usados.has(g.id)).map((g) => ({ id: g.id, rotulo: t.groups[g.id] }));
  const temAprender = titulo.has("aprender-a-estudar");

  return (
    <div className="mx-auto max-w-5xl px-4 py-12" data-catalogo-de-cursos="">
      <PageHeading eyebrow={s.catalogo.olho} title={s.catalogo.titulo}>
        {s.catalogo.lead}
      </PageHeading>
      <p className="mt-6 font-sans text-sm text-ink-soft">{s.catalogo.conteudoEmPortugues}</p>
      {temAprender && (
        <p className="aviso-aprender-a-estudar">
          <Link href={localePath(lang, "/escola/cursos/aprender-a-estudar")} className="font-semibold underline hover:text-oxblood">
            {s.catalogo.comece}
          </Link>
        </p>
      )}
      <CatalogoDeCursos cartoes={cartoes} grupos={grupos} s={{ catalogo: s.catalogo, ciclos: s.ciclos, formatos: s.formatos, objetivos: s.objetivos }} />
    </div>
  );
}
