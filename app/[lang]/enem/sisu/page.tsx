// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SimuladorSisu } from "@/components/enem/SimuladorSisu";
import { PageHeading } from "@/components/PageHeading";
import { Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { formatarFato } from "@/lib/enem";
import { edicaoDoEnem, matrizDoEnem } from "@/lib/enem-conteudo";
import { ligado } from "@/lib/recursos";
import { paginaMeta } from "@/lib/seo";
import { textosDoEstudo } from "@/lib/textos-estudo";

export async function generateMetadata({ params }: PageProps<"/[lang]/enem/sisu">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const { s } = textosDoEstudo(lang);
  return paginaMeta(lang, "/enem/sisu", s.enem.sisu.titulo, s.enem.sisu.lead);
}

/** A média ponderada do Sisu (recurso "enem-curso"): as notas da pessoa contra as ofertas reais do Sisu,
 * com os pesos de cada curso e as notas de corte da ampla concorrência desde 2020 (dados do sisu-data, MIT). */
export default async function Page({ params }: PageProps<"/[lang]/enem/sisu">) {
  if (!ligado("enem-curso")) notFound();
  const { lang, t } = await loadLang(params);
  const { s: todos, traduzido } = textosDoEstudo(lang);
  const s = todos.enem;
  const ed = edicaoDoEnem();
  const fato = ed.fatos["sisu-media-ponderada"];
  const m = matrizDoEnem();
  const nomes = { linguagens: m.areas.linguagens.nome, humanas: m.areas.humanas.nome, natureza: m.areas.natureza.nome, matematica: m.areas.matematica.nome, redacao: s.sisu.redacao };
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <PageHeading eyebrow={s.titulo} title={s.sisu.titulo} voltar={{ href: localePath(lang, "/enem"), texto: s.titulo }}>
        {s.sisu.lead}
      </PageHeading>
      <Untranslated lang={lang} t={t} show={!traduzido} />
      <p className="mt-6 font-sans text-sm">
        {s.sisu.comoFunciona} {formatarFato(fato)} (<a href={ed.fontes[fato.fonte].url} className="underline hover:text-oxblood" rel="noopener noreferrer">{ed.fontes[fato.fonte].titulo}</a>).
      </p>
      <SimuladorSisu nomes={nomes} s={s.sisu} />
      <p className="mt-6 font-sans text-sm">
        {s.sisu.fonte}{" "}
        <a href="https://github.com/maiakanegae/sisu-data" className="underline hover:text-oxblood" rel="noopener noreferrer">sisu-data</a>{" · "}
        <a href={ed.fontes.sisu.url} className="underline hover:text-oxblood" rel="noopener noreferrer">{ed.fontes.sisu.titulo}</a>
      </p>
      <ul className="mt-4 list-disc space-y-1 pl-5 font-sans text-xs">
        <li>{s.sisu.cortesConferidos}</li>
        <li>{s.sisu.cortes2021}</li>
        <li>{s.sisu.cortesPesos}</li>
        <li>{s.sisu.cortesSemNota}</li>
      </ul>
      <p className="mt-2 font-mono text-xs">{s.sisu.conta}</p>
    </div>
  );
}
