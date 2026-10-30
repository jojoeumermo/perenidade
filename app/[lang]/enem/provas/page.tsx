// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "@/components/Link";
import { PageHeading } from "@/components/PageHeading";
import { Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { fill, localePath } from "@/i18n/config";
import { anosClassificados, anosComProva } from "@/lib/enem-camada";
import { ligado } from "@/lib/recursos";
import { paginaMeta } from "@/lib/seo";
import { textosDoEstudo } from "@/lib/textos-estudo";

export async function generateMetadata({ params }: PageProps<"/[lang]/enem/provas">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const { s } = textosDoEstudo(lang);
  return paginaMeta(lang, "/enem/provas", s.enem.provas.titulo, s.enem.provas.lead);
}

/** As provas oficiais do Enem por ano e por dia (recurso "enem-curso"). */
export default async function Page({ params }: PageProps<"/[lang]/enem/provas">) {
  if (!ligado("enem-curso")) notFound();
  const { lang, t } = await loadLang(params);
  const { s: todos, traduzido } = textosDoEstudo(lang);
  const s = todos.enem;
  const p = s.provas;
  const classificados = new Map(anosClassificados().map((a) => [a.ano, a.porArea]));
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <PageHeading eyebrow={s.titulo} title={p.titulo} voltar={{ href: localePath(lang, "/enem"), texto: s.titulo }}>
        {p.lead}
      </PageHeading>
      <Untranslated lang={lang} t={t} show={!traduzido} />
      <p className="mt-6 border border-rule bg-parchment-deep p-4 font-sans text-sm text-ink-soft">{p.aviso}</p>
      <ul className="mt-6 space-y-4">
        {anosComProva().map((ano) => {
          const porArea = classificados.get(ano);
          const antigo = ano <= 2016;
          const dia1 = porArea ? (antigo ? porArea.humanas + porArea.natureza : porArea.linguagens + porArea.humanas) : 0;
          const dia2 = porArea ? (antigo ? porArea.linguagens + porArea.matematica : porArea.natureza + porArea.matematica) : 0;
          return (
            <li key={ano} className="border-2 border-ink bg-parchment-deep p-4">
              <h2 className="font-serif text-2xl font-semibold">{fill(p.ano, { ano })}</h2>
              <ul className="mt-2 grid gap-3 font-sans text-sm sm:grid-cols-2">
                {([1, 2] as const).map((dia) => (
                  <li key={dia}>
                    <Link href={localePath(lang, `/enem/provas/${ano}/${dia}`)} className="block border border-rule bg-parchment p-3 hover:border-oxblood">
                      <strong>{fill(p.dia, { n: dia })}</strong>: {ano <= 2016 ? (dia === 1 ? p.antigo1 : p.antigo2) : dia === 1 ? p.diaConteudo1 : p.diaConteudo2}
                      {(dia === 1 ? dia1 : dia2) > 0 && <span className="mt-1 block font-mono text-xs text-ink-soft">{fill(p.comResolucao, { n: dia === 1 ? dia1 : dia2 })}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
