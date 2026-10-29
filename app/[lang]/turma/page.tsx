// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Turma } from "@/components/estudo/Turma";
import { PageHeading } from "@/components/PageHeading";
import { Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { ligado } from "@/lib/recursos";
import { paginaMeta } from "@/lib/seo";
import { textosDoEstudo } from "@/lib/textos-estudo";

export async function generateMetadata({ params }: PageProps<"/[lang]/turma">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const { s } = textosDoEstudo(lang);
  return { ...paginaMeta(lang, "/turma", s.turma.titulo, s.turma.descricao), robots: { index: false, follow: true } };
}

/**
 * Modo turma (recurso "turma"): o professor monta uma sequência de aulas e manda o link; a sequência vai no próprio
 * link, depois do "#", e nunca passa pelo servidor. Desligado, a página não existe.
 */
export default async function Page({ params }: PageProps<"/[lang]/turma">) {
  if (!ligado("turma")) notFound();
  const { lang, t } = await loadLang(params);
  const { s, traduzido } = textosDoEstudo(lang);
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <PageHeading eyebrow={s.turma.olho} title={s.turma.titulo}>
        {s.turma.lead}
      </PageHeading>
      <Untranslated lang={lang} t={t} show={!traduzido} />
      <Turma s={s.turma} />
    </div>
  );
}
