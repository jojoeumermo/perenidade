// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EscolherLista } from "@/components/enem/EscolherLista";
import { PageHeading } from "@/components/PageHeading";
import { Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { AREAS_DO_ENEM } from "@/lib/enem";
import { resumosDasHabilidades } from "@/lib/enem-camada";
import { matrizDoEnem, simuladosDoEnem } from "@/lib/enem-conteudo";
import { ligado } from "@/lib/recursos";
import { paginaMeta } from "@/lib/seo";
import { textosDoEstudo } from "@/lib/textos-estudo";

export async function generateMetadata({ params }: PageProps<"/[lang]/enem/diagnostico">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const { s } = textosDoEstudo(lang);
  return { ...paginaMeta(lang, "/enem/diagnostico", s.enem.diagnostico.titulo, s.enem.diagnostico.lead), robots: { index: false, follow: true } };
}

/** O diagnóstico do curso: 15 questões oficiais por área, sem nota; o resultado fica no aparelho e alimenta o plano. */
export default async function Page({ params }: PageProps<"/[lang]/enem/diagnostico">) {
  if (!ligado("enem-curso")) notFound();
  const sim = simuladosDoEnem();
  if (!sim) notFound();
  const { lang, t } = await loadLang(params);
  const { s: todos, traduzido } = textosDoEstudo(lang);
  const s = todos.enem;
  const matriz = matrizDoEnem();
  const areas = Object.fromEntries(AREAS_DO_ENEM.map((a) => [a, matriz.areas[a].nome]));
  const opcoes = AREAS_DO_ENEM.map((a) => ({ id: `diagnostico-${a}`, titulo: areas[a], detalhe: s.diagnostico.areaLead, ids: sim.diagnostico[a], minutos: 45 }));
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <PageHeading eyebrow={s.titulo} title={s.diagnostico.titulo} voltar={{ href: localePath(lang, "/enem"), texto: s.titulo }}>
        {s.diagnostico.lead}
      </PageHeading>
      <Untranslated lang={lang} t={t} show={!traduzido} />
      <h2 className="mt-8 font-serif text-2xl font-semibold">{s.diagnostico.area}</h2>
      <EscolherLista opcoes={opcoes} diagnostico rotuloAbrir={s.provas.comecar} habilidades={resumosDasHabilidades()} areas={areas} s={s} />
    </div>
  );
}
