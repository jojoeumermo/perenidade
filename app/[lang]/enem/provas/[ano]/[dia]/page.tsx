// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProvaOficial } from "@/components/enem/ProvaOficial";
import { PageHeading } from "@/components/PageHeading";
import { Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { fill, localePath } from "@/i18n/config";
import { AREAS_DO_ENEM } from "@/lib/enem";
import { anosComProva, resumosDasHabilidades } from "@/lib/enem-camada";
import { edicaoDoEnem, matrizDoEnem } from "@/lib/enem-conteudo";
import { withLangs } from "@/lib/params";
import { ligado } from "@/lib/recursos";
import { paginaMeta } from "@/lib/seo";
import { textosDoEstudo } from "@/lib/textos-estudo";

export const dynamicParams = false;

export function generateStaticParams() {
  return withLangs(anosComProva().flatMap((ano) => [1, 2].map((dia) => ({ ano: String(ano), dia: String(dia) }))));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/enem/provas/[ano]/[dia]">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const { ano, dia } = await params;
  const { s } = textosDoEstudo(lang);
  return paginaMeta(lang, `/enem/provas/${ano}/${dia}`, `${fill(s.enem.provas.ano, { ano })}, ${fill(s.enem.provas.dia, { n: dia })}`, s.enem.provas.lead);
}

/** Uma prova oficial do Enem, de um dia, no tempo da prova (recurso "enem-curso"). */
export default async function Page({ params }: PageProps<"/[lang]/enem/provas/[ano]/[dia]">) {
  if (!ligado("enem-curso")) notFound();
  const { lang, t } = await loadLang(params);
  const { ano: anoTexto, dia: diaTexto } = await params;
  const ano = Number(anoTexto);
  const dia = Number(diaTexto) as 1 | 2;
  if (!anosComProva().includes(ano) || (dia !== 1 && dia !== 2)) notFound();
  const { s: todos, traduzido } = textosDoEstudo(lang);
  const s = todos.enem;
  const fatos = edicaoDoEnem().fatos;
  const minutos = Number(fatos[dia === 1 ? "duracao-dia-1" : "duracao-dia-2"].valor);
  const matriz = matrizDoEnem();
  const areas = Object.fromEntries(AREAS_DO_ENEM.map((a) => [a, matriz.areas[a].nome]));
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <PageHeading eyebrow={s.provas.titulo} title={`${fill(s.provas.ano, { ano })}, ${fill(s.provas.dia, { n: dia })}`} voltar={{ href: localePath(lang, "/enem/provas"), texto: s.provas.outras }}>
        {ano <= 2016 ? (dia === 1 ? s.provas.antigo1 : s.provas.antigo2) : dia === 1 ? s.provas.diaConteudo1 : s.provas.diaConteudo2}
      </PageHeading>
      <Untranslated lang={lang} t={t} show={!traduzido} />
      <p className="mt-6 border border-rule bg-parchment-deep p-4 font-sans text-sm text-ink-soft">{s.provas.aviso}</p>
      <ProvaOficial fonte={{ tipo: "dia", ano, dia, minutos }} habilidades={resumosDasHabilidades()} areas={areas} s={s} />
    </div>
  );
}
