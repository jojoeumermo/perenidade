// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PraticaOficial } from "@/components/enem/PraticaOficial";
import { PageHeading } from "@/components/PageHeading";
import { Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { AREAS_DO_ENEM } from "@/lib/enem";
import { anosClassificados, objetosParaFiltro, resumosDasHabilidades } from "@/lib/enem-camada";
import { matrizDoEnem } from "@/lib/enem-conteudo";
import { ligado } from "@/lib/recursos";
import { paginaMeta } from "@/lib/seo";
import { textosDoEstudo } from "@/lib/textos-estudo";

export async function generateMetadata({ params }: PageProps<"/[lang]/enem/praticar">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const { s } = textosDoEstudo(lang);
  return paginaMeta(lang, "/enem/praticar", s.enem.praticar.titulo, s.enem.praticar.lead);
}

/** Prática por habilidade com as questões oficiais classificadas (recurso "enem-curso"). */
export default async function Page({ params }: PageProps<"/[lang]/enem/praticar">) {
  if (!ligado("enem-curso")) notFound();
  const { lang, t } = await loadLang(params);
  const { s: todos, traduzido } = textosDoEstudo(lang);
  const s = todos.enem;
  const matriz = matrizDoEnem();
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <PageHeading eyebrow={s.titulo} title={s.praticar.titulo} voltar={{ href: localePath(lang, "/enem"), texto: s.titulo }}>
        {s.praticar.lead}
      </PageHeading>
      <Untranslated lang={lang} t={t} show={!traduzido} />
      <PraticaOficial anos={anosClassificados().map((a) => a.ano)} areas={Object.fromEntries(AREAS_DO_ENEM.map((a) => [a, matriz.areas[a].nome]))} objetos={objetosParaFiltro()} habilidades={resumosDasHabilidades()} s={s} />
    </div>
  );
}
