// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DozeEixos, type DadosDosEixos } from "@/components/estudo/DozeEixos";
import { PageHeading } from "@/components/PageHeading";
import { Untranslated } from "@/components/Untranslated";
import eixos from "@/content/eixos.json";
import { loadLang } from "@/i18n";
import { defaultLocale } from "@/i18n/config";
import { ligado } from "@/lib/recursos";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/nivelamento/eixos">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/nivelamento/eixos", t.eixos.title, t.eixos.description);
}

/**
 * O teste dos 12 eixos políticos (parte do nivelamento): perguntas, eixos e ideologias em content/eixos.json, só em
 * português por enquanto; a conta e a tela estão em components/estudo/DozeEixos.tsx. Fica junto com o nivelamento:
 * com o recurso desligado, a página não existe.
 */
export default async function Page({ params }: PageProps<"/[lang]/nivelamento/eixos">) {
  if (!ligado("nivelamento")) notFound();
  const { lang, t } = await loadLang(params);
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <PageHeading eyebrow={t.eixos.eyebrow} title={t.eixos.title}>
        {t.eixos.lead}
      </PageHeading>
      <Untranslated lang={lang} t={t} show={lang !== defaultLocale} />
      <DozeEixos dados={eixos as DadosDosEixos} s={t.eixos} />
    </div>
  );
}
