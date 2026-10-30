// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MeuPlano } from "@/components/enem/MeuPlano";
import { PageHeading } from "@/components/PageHeading";
import { Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { AREAS_DO_ENEM } from "@/lib/enem";
import { topicosParaPlano } from "@/lib/enem-camada";
import { edicaoDoEnem, matrizDoEnem } from "@/lib/enem-conteudo";
import { ligado } from "@/lib/recursos";
import { paginaMeta } from "@/lib/seo";
import { textosDoEstudo } from "@/lib/textos-estudo";

export async function generateMetadata({ params }: PageProps<"/[lang]/enem/plano">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const { s } = textosDoEstudo(lang);
  return { ...paginaMeta(lang, "/enem/plano", s.enem.plano.titulo, s.enem.plano.lead), robots: { index: false, follow: true } };
}

/** O plano de estudos do curso ENEM, montado e guardado no aparelho (recurso "enem-curso"). */
export default async function Page({ params }: PageProps<"/[lang]/enem/plano">) {
  if (!ligado("enem-curso")) notFound();
  const { lang, t } = await loadLang(params);
  const { s: todos, traduzido } = textosDoEstudo(lang);
  const s = todos.enem;
  const matriz = matrizDoEnem();
  const areas = Object.fromEntries(AREAS_DO_ENEM.map((a) => [a, matriz.areas[a].nome]));
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <PageHeading eyebrow={s.titulo} title={s.plano.titulo} voltar={{ href: localePath(lang, "/enem"), texto: s.titulo }}>
        {s.plano.lead}
      </PageHeading>
      <Untranslated lang={lang} t={t} show={!traduzido} />
      <MeuPlano topicos={topicosParaPlano()} prova={String(edicaoDoEnem().fatos["aplicacao-dia-1"].valor)} areas={areas} s={s.plano} />
    </div>
  );
}
