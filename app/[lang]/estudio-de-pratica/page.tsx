// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "@/components/Link";
import { SecaoEstudioDePratica } from "@/components/EstudioDePraticaSecao";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { type AreaDoEstudio, ESTUDIOS } from "@/lib/estudio";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/estudio-de-pratica">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/estudio-de-pratica", t.practiceStudio.title, t.practiceStudio.lead);
}

/** Estúdio de prática: os programas de Edição de vídeo, Edição de foto e Modelagem 3D, com avisos, limites e material. */
export default async function EstudioDePratica({ params }: PageProps<"/[lang]/estudio-de-pratica">) {
  const { lang, t } = await loadLang(params);
  const s = t.practiceStudio;
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <PageHeading eyebrow={s.eyebrow} title={s.title}>{s.lead}</PageHeading>
      {(Object.keys(ESTUDIOS) as AreaDoEstudio[]).map((area) => (
        <div key={area} className="mt-12">
          <h2 className="border-b border-rule pb-3 font-serif text-3xl font-semibold">
            <Link href={localePath(lang, `/estantes/${area}`)} className="hover:text-oxblood">{t.areas[area][0]}</Link>
          </h2>
          <SecaoEstudioDePratica s={s} titulo={false} area={area} />
        </div>
      ))}
    </div>
  );
}
