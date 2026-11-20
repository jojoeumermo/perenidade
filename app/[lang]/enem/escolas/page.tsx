// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RankingEscolas } from "@/components/enem/RankingEscolas";
import { PageHeading } from "@/components/PageHeading";
import { Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { fill, localePath } from "@/i18n/config";
import { matrizDoEnem } from "@/lib/enem-conteudo";
import { ligado } from "@/lib/recursos";
import { paginaMeta } from "@/lib/seo";
import { textosDoEstudo } from "@/lib/textos-estudo";

export async function generateMetadata({ params }: PageProps<"/[lang]/enem/escolas">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const { s } = textosDoEstudo(lang);
  return paginaMeta(lang, "/enem/escolas", s.enem.escolas.titulo, s.enem.escolas.lead);
}

/** O ranking das escolas do Brasil pelas médias do Enem 2024 (recurso "enem-curso"): média simples dos
 * participantes válidos por escola, com os nomes do Censo Escolar. Dados públicos do Inep em public/escolas/. */
export default async function Page({ params }: PageProps<"/[lang]/enem/escolas">) {
  if (!ligado("enem-curso")) notFound();
  const { lang, t } = await loadLang(params);
  const { s: todos, traduzido } = textosDoEstudo(lang);
  const s = todos.enem;
  const m = matrizDoEnem();
  // a ordem das médias nos arquivos de public/escolas/ é CN, CH, LC, MT, RED
  const areas = [m.areas.natureza.nome, m.areas.humanas.nome, m.areas.linguagens.nome, m.areas.matematica.nome, s.escolas.redacao];
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <PageHeading eyebrow={s.titulo} title={s.escolas.titulo} voltar={{ href: localePath(lang, "/enem"), texto: s.titulo }}>
        {s.escolas.lead}
      </PageHeading>
      <Untranslated lang={lang} t={t} show={!traduzido} />
      <p className="mt-6 font-sans text-sm">{fill(s.escolas.metodologia, { min: 10 })}</p>
      <RankingEscolas areas={areas} s={s.escolas} />
      <p className="mt-6 font-sans text-sm">{s.escolas.cuidados}</p>
      <p className="mt-2 font-sans text-sm">
        {s.escolas.fonte}{" "}
        <a href="https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/enem" className="underline hover:text-oxblood" rel="noopener noreferrer">{s.escolas.fonteEnem}</a>{" · "}
        <a href="https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/censo-escolar" className="underline hover:text-oxblood" rel="noopener noreferrer">{s.escolas.fonteCenso}</a>
      </p>
      <p className="mt-2 font-mono text-xs">{s.escolas.conta}</p>
    </div>
  );
}
