// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { JogosDeFormacao, type DadosDaGreve, type Fato, type Frase } from "@/components/labs/JogosDeFormacao";
import { PageHeading } from "@/components/PageHeading";
import { Untranslated } from "@/components/Untranslated";
import frases from "@/content/frases.json";
import greve from "@/content/jogos/greve.json";
import rumosFilosofia from "@/content/jogos/rumos-filosofia-e-sociologia.json";
import rumosHistoria from "@/content/jogos/rumos-historia-do-brasil.json";
import rumosPolitica from "@/content/jogos/rumos-politica-e-cidadania.json";
import rumosEnem from "@/content/jogos/rumos-revisao-enem.json";
import nesteDia from "@/content/neste-dia.json";
import { loadLang } from "@/i18n";
import { defaultLocale } from "@/i18n/config";
import { BARALHOS_DE_RUMOS } from "@/lib/laboratorios";
import { validarBaralho, type Baralho } from "@/lib/rumos";
import { paginaMeta } from "@/lib/seo";

const TRILHAS = path.join(process.cwd(), "content", "trilhas");

/**
 * Os baralhos do Rumos, conferidos aqui: baralho inválido derruba o build com a lista dos problemas. A conferência das
 * aulas só roda onde a pasta content/trilhas existe (no build); `npm run testar:jogos` faz a mesma conferência no CI.
 */
function baralhosConferidos(): Baralho[] {
  const porId: Record<string, unknown> = {
    "historia-do-brasil": rumosHistoria,
    "filosofia-e-sociologia": rumosFilosofia,
    "politica-e-cidadania": rumosPolitica,
    "revisao-enem": rumosEnem,
  };
  const aulaExiste = fs.existsSync(TRILHAS) ? (href: string) => fs.existsSync(path.join(TRILHAS, `${href.replace(/^\/trilhas\//, "")}.md`)) : undefined;
  const erros = BARALHOS_DE_RUMOS.flatMap((id) => (porId[id] ? validarBaralho(porId[id], { aulaExiste }) : [`${id}: baralho registrado em lib/laboratorios.ts sem arquivo`]));
  if (erros.length) throw new Error(`Baralhos do Rumos com problema:\n${erros.join("\n")}`);
  return BARALHOS_DE_RUMOS.map((id) => porId[id] as Baralho);
}

export async function generateMetadata({ params }: PageProps<"/[lang]/laboratorios/jogos">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/laboratorios/jogos", t.labs.jogos.title, t.labs.jogos.lead);
}

/**
 * Jogos de formação militante: Rumos (o jogo de decisões, content/jogos/rumos-*.json), Greve! (decisões numa greve,
 * content/jogos/greve.json), Linha do tempo (os fatos de content/neste-dia.json) e Quem disse? (as frases de
 * content/frases.json). Os textos dos jogos estão em português.
 */
export default async function Page({ params }: PageProps<"/[lang]/laboratorios/jogos">) {
  const { lang, t } = await loadLang(params);
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <PageHeading eyebrow={t.labs.eyebrow} title={t.labs.jogos.title}>
        {t.labs.jogos.lead}
      </PageHeading>
      <Untranslated lang={lang} t={t} show={lang !== defaultLocale} />
      <JogosDeFormacao baralhos={baralhosConferidos()} greve={greve as DadosDaGreve} fatos={(nesteDia as { fatos: Fato[] }).fatos} frases={frases as Frase[]} s={t.labs.jogos} />
    </div>
  );
}
