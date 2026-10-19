// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "next/link";
import { SecaoEstudioDePratica } from "@/components/EstudioDePraticaSecao";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/estudio-de-pratica">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/estudio-de-pratica", t.practiceStudio.title, t.practiceStudio.lead);
}

/** Estúdio de prática: FilmCraft e EffectCraft para a disciplina Edição de vídeo, com avisos, limites e material. */
export default async function EstudioDePratica({ params }: PageProps<"/[lang]/estudio-de-pratica">) {
  const { lang, t } = await loadLang(params);
  const s = t.practiceStudio;
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <Link href={localePath(lang, "/estantes/edicao-de-video")} className="font-sans text-sm text-ink-soft hover:text-oxblood">← {t.areas["edicao-de-video"][0]}</Link>
      <div className="mt-6">
        <PageHeading eyebrow={s.eyebrow} title={s.title}>{s.lead}</PageHeading>
      </div>
      <SecaoEstudioDePratica s={s} titulo={false} />
    </div>
  );
}
