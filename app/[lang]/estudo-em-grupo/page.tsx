// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { EstudoEmGrupo } from "@/components/EstudoEmGrupo";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/estudo-em-grupo">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/estudo-em-grupo", t.studyGroup.title, t.studyGroup.lead);
}

// Sala de estudo em grupo: vídeo pelo Jitsi das aulas ao vivo e o mesmo cronômetro de foco para todo mundo da sala.
export default async function SalaDeEstudo({ params }: PageProps<"/[lang]/estudo-em-grupo">) {
  const { t } = await loadLang(params);
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <PageHeading eyebrow={t.studyGroup.eyebrow} title={t.studyGroup.title}>
        {t.studyGroup.lead}
      </PageHeading>
      <EstudoEmGrupo s={t.studyGroup} />
    </div>
  );
}
