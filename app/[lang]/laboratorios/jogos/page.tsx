// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { JogosDeFormacao, type DadosDaGreve, type Fato, type Frase } from "@/components/labs/JogosDeFormacao";
import { PageHeading } from "@/components/PageHeading";
import { Untranslated } from "@/components/Untranslated";
import frases from "@/content/frases.json";
import greve from "@/content/jogos/greve.json";
import nesteDia from "@/content/neste-dia.json";
import { loadLang } from "@/i18n";
import { defaultLocale } from "@/i18n/config";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/laboratorios/jogos">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/laboratorios/jogos", t.labs.jogos.title, t.labs.jogos.lead);
}

/**
 * Jogos de formação militante: Greve! (decisões numa greve, content/jogos/greve.json), Linha do tempo (os fatos de
 * content/neste-dia.json) e Quem disse? (as frases de content/frases.json). Os textos dos jogos estão em português.
 */
export default async function Page({ params }: PageProps<"/[lang]/laboratorios/jogos">) {
  const { lang, t } = await loadLang(params);
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <PageHeading eyebrow={t.labs.eyebrow} title={t.labs.jogos.title}>
        {t.labs.jogos.lead}
      </PageHeading>
      <Untranslated lang={lang} t={t} show={lang !== defaultLocale} />
      <JogosDeFormacao greve={greve as DadosDaGreve} fatos={(nesteDia as { fatos: Fato[] }).fatos} frases={frases as Frase[]} s={t.labs.jogos} />
    </div>
  );
}
