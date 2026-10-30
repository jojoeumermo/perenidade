// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LaboratorioTri } from "@/components/enem/LaboratorioTri";
import Link from "@/components/Link";
import { PageHeading } from "@/components/PageHeading";
import { Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { formatarFato } from "@/lib/enem";
import { edicaoDoEnem } from "@/lib/enem-conteudo";
import { ligado } from "@/lib/recursos";
import { paginaMeta } from "@/lib/seo";
import { textosDoEstudo } from "@/lib/textos-estudo";

export async function generateMetadata({ params }: PageProps<"/[lang]/enem/laboratorio-tri">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const { s } = textosDoEstudo(lang);
  return paginaMeta(lang, "/enem/laboratorio-tri", s.enem.tri.titulo, s.enem.tri.lead);
}

/** O laboratório da TRI (recurso "enem-curso"): modelo de 3 parâmetros com itens ilustrativos; não calcula a nota oficial. */
export default async function Page({ params }: PageProps<"/[lang]/enem/laboratorio-tri">) {
  if (!ligado("enem-curso")) notFound();
  const { lang, t } = await loadLang(params);
  const { s: todos, traduzido } = textosDoEstudo(lang);
  const s = todos.enem;
  const tri = edicaoDoEnem().fatos["nota-tri"];
  const fonte = edicaoDoEnem().fontes[tri.fonte];
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <PageHeading eyebrow={s.titulo} title={s.tri.titulo} voltar={{ href: localePath(lang, "/enem"), texto: s.titulo }}>
        {s.tri.lead}
      </PageHeading>
      <Untranslated lang={lang} t={t} show={!traduzido} />
      <p className="mt-6 font-sans text-sm">
        {s.tri.oficial} {formatarFato(tri)} (<a href={fonte.url} className="underline hover:text-oxblood" rel="noopener noreferrer">{fonte.titulo}, item {tri.item}</a>).
      </p>
      <LaboratorioTri s={s.tri} />
      <p className="mt-6 font-sans text-sm">
        <Link href={localePath(lang, "/trilhas/enem-como-funciona/a-nota-o-que-e-a-tri")} className="underline hover:text-oxblood">{s.tri.aula} →</Link>
      </p>
    </div>
  );
}
