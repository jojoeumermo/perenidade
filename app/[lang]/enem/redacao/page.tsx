// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OficinaDeRedacao } from "@/components/enem/OficinaDeRedacao";
import Link from "@/components/Link";
import { PageHeading } from "@/components/PageHeading";
import { Redacao } from "@/components/tools/Estudo";
import { Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { redacaoDoEnem } from "@/lib/enem-conteudo";
import { ligado } from "@/lib/recursos";
import { paginaMeta } from "@/lib/seo";
import { textosDoEstudo } from "@/lib/textos-estudo";

export async function generateMetadata({ params }: PageProps<"/[lang]/enem/redacao">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const { s } = textosDoEstudo(lang);
  return paginaMeta(lang, "/enem/redacao", s.enem.oficina.titulo, s.enem.oficina.lead);
}

/** A oficina de redação do curso ENEM (recurso "enem-curso"), em cima da ferramenta de redação que o site já tem. */
export default async function Page({ params }: PageProps<"/[lang]/enem/redacao">) {
  if (!ligado("enem-curso")) notFound();
  const { lang, t } = await loadLang(params);
  const { s: todos, traduzido } = textosDoEstudo(lang);
  const s = todos.enem;
  const { propostas, repertorio } = redacaoDoEnem();
  if (!propostas.length) notFound();
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <PageHeading eyebrow={s.titulo} title={s.oficina.titulo} voltar={{ href: localePath(lang, "/enem"), texto: s.titulo }}>
        {s.oficina.lead}
      </PageHeading>
      <Untranslated lang={lang} t={t} show={!traduzido} />
      <p className="mt-6 font-sans text-sm">
        <Link href={localePath(lang, "/trilhas/enem-reta-final/redacao-expressa-a-estrutura-em-30-linhas")} className="underline hover:text-oxblood">{s.secoes.redacao} →</Link>
      </p>
      <OficinaDeRedacao propostas={propostas} repertorio={repertorio} eixos={s.oficina.eixos} s={s.oficina} folha={<Redacao s={t.tools.essay} lang={lang} />} />
    </div>
  );
}
