// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EscolherLista } from "@/components/enem/EscolherLista";
import Link from "@/components/Link";
import { PageHeading } from "@/components/PageHeading";
import { Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { fill, localePath } from "@/i18n/config";
import { AREAS_DO_ENEM } from "@/lib/enem";
import { relogio } from "@/lib/enem-aparelho";
import { resumosDasHabilidades } from "@/lib/enem-camada";
import { matrizDoEnem, simuladosDoEnem } from "@/lib/enem-conteudo";
import { ligado } from "@/lib/recursos";
import { paginaMeta } from "@/lib/seo";
import { textosDoEstudo } from "@/lib/textos-estudo";

export async function generateMetadata({ params }: PageProps<"/[lang]/enem/simulados">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const { s } = textosDoEstudo(lang);
  return paginaMeta(lang, "/enem/simulados", s.enem.minis.titulo, s.enem.minis.lead);
}

/** Minissimulados por área, com questões oficiais classificadas (recurso "enem-curso"). As provas completas ficam em /enem/provas. */
export default async function Page({ params }: PageProps<"/[lang]/enem/simulados">) {
  if (!ligado("enem-curso")) notFound();
  const sim = simuladosDoEnem();
  if (!sim) notFound();
  const { lang, t } = await loadLang(params);
  const { s: todos, traduzido } = textosDoEstudo(lang);
  const s = todos.enem;
  const matriz = matrizDoEnem();
  const areas = Object.fromEntries(AREAS_DO_ENEM.map((a) => [a, matriz.areas[a].nome]));
  const opcoes = sim.minissimulados.map((m) => ({ id: m.id, titulo: fill(s.minis.item, { area: areas[m.area], n: Number(m.id.slice(-2)) }), detalhe: fill(s.minis.questoes, { n: m.questoes.length, t: relogio(m.minutos * 60) }), ids: m.questoes, minutos: m.minutos }));
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <PageHeading eyebrow={s.titulo} title={s.minis.titulo} voltar={{ href: localePath(lang, "/enem"), texto: s.titulo }}>
        {s.minis.lead}
      </PageHeading>
      <Untranslated lang={lang} t={t} show={!traduzido} />
      <p className="mt-6 font-sans text-sm">
        <Link href={localePath(lang, "/enem/provas")} className="font-semibold underline hover:text-oxblood">{s.provas.titulo} →</Link>
      </p>
      <EscolherLista opcoes={opcoes} rotuloAbrir={s.provas.comecar} habilidades={resumosDasHabilidades()} areas={areas} s={s} />
    </div>
  );
}
