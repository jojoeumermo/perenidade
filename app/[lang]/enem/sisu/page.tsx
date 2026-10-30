// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalculadoraSisu } from "@/components/enem/CalculadoraSisu";
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

/** A média ponderada do Sisu (recurso "enem-curso"): notas e pesos digitados pela pessoa; sem nota de corte. */
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
      <CalculadoraSisu nomes={nomes} s={s.sisu} />
      <p className="mt-6 font-sans text-sm">
        {s.sisu.semCorte}{" "}
        <a href={ed.fontes.sisu.url} className="underline hover:text-oxblood" rel="noopener noreferrer">{ed.fontes.sisu.titulo}</a>
      </p>
    </div>
  );
}
