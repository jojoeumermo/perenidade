// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { PlanoDaSemana } from "@/components/escola/plano/PlanoDaSemana";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { aulasDoAparelho, cursosDoAparelho, textosDaMatricula } from "@/lib/escola/matricula-servidor";
import { textosDaBase } from "@/lib/escola/textos";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/escola/plano">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const s = textosDaMatricula(lang);
  return { ...paginaMeta(lang, "/escola/plano", `${s.meta.plano.titulo} · ${textosDaBase(lang).meta.titulo}`, s.meta.plano.descricao), robots: { index: false, follow: true } };
}

/**
 * O plano da semana sem culpa (E4-08, R1-52; docs/escola/matricula.md): montado no aparelho por regras simples, não por
 * inteligência artificial. A página manda os cursos e os minutos estimados de cada aula; o resto é do aparelho.
 */
export default async function Page({ params }: PageProps<"/[lang]/escola/plano">) {
  const { lang } = await loadLang(params);
  const s = textosDaMatricula(lang);
  const base = textosDaBase(lang);
  const cursos = cursosDoAparelho();
  return (
    <div className="mx-auto max-w-3xl px-4 py-12" data-pagina-plano="">
      <PageHeading eyebrow={s.comum.olho} title={s.meta.plano.titulo} voltar={{ href: localePath(lang, "/escola"), texto: base.nav.entrada }}>
        {s.plano.lead}
      </PageHeading>
      <PlanoDaSemana s={s.plano} comum={s.comum} convite={s.quemVolta.convite} cursos={cursos} aulas={aulasDoAparelho(lang, cursos)} lang={lang} />
    </div>
  );
}
