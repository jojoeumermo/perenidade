// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { FluxoDaMatricula } from "@/components/escola/matricula/FluxoDaMatricula";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { cursosDoAparelho, testesDosCursos, textosDaMatricula } from "@/lib/escola/matricula-servidor";
import { textosDaBase } from "@/lib/escola/textos";
import { ligado } from "@/lib/recursos";
import { paginaMeta } from "@/lib/seo";
import { textosDoEstudo } from "@/lib/textos-estudo";

export async function generateMetadata({ params }: PageProps<"/[lang]/escola/matricula">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const s = textosDaMatricula(lang);
  return paginaMeta(lang, "/escola/matricula", `${s.meta.matricula.titulo} · ${textosDaBase(lang).meta.titulo}`, s.meta.matricula.descricao);
}

/**
 * Matrícula sem cadastro da Escola Revolucionária Lúcia Maria (E4-08, D1-9; docs/escola/matricula.md). A página é a mesma para todo
 * mundo (sem dado de ninguém no HTML); o fluxo lê e grava só no aparelho. O ?curso= do catálogo é lido no navegador,
 * para a página continuar estática.
 */
export default async function Page({ params }: PageProps<"/[lang]/escola/matricula">) {
  const { lang } = await loadLang(params);
  const s = textosDaMatricula(lang);
  const base = textosDaBase(lang);
  const cursos = cursosDoAparelho();
  // O nivelamento só existe com o recurso "nivelamento" ligado (como a página /nivelamento).
  const testes = ligado("nivelamento") ? testesDosCursos(lang, cursos) : [];
  return (
    <div className="mx-auto max-w-3xl px-4 py-12" data-pagina-matricula="">
      <PageHeading eyebrow={s.comum.olho} title={s.meta.matricula.titulo} voltar={{ href: localePath(lang, "/escola"), texto: base.nav.entrada }}>
        {base.entrada.linhaNaoUniversidade}
      </PageHeading>
      <FluxoDaMatricula s={s.fluxo} comum={s.comum} sNivelamento={textosDoEstudo(lang).s.nivelamento} cursos={cursos} testes={testes} lang={lang} />
    </div>
  );
}
