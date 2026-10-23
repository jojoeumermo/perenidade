// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { ContentPageView } from "@/components/ContentPageView";
import { TarefasDeVoluntariado } from "@/components/governanca/Governanca";
import { VolunteerForm } from "@/components/VolunteerForm";
import voluntariado from "@/content/voluntariado.json";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";
import { getPage } from "@/lib/content";

export async function generateMetadata({ params }: PageProps<"/[lang]/voluntarios">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const page = getPage("voluntarios", lang);
  return paginaMeta(lang, "/voluntarios", page.title, page.lead);
}

// O voluntariado numa página só: as funções da equipe, as tarefas rápidas (que antes ficavam em "Voluntarie-se") e a
// candidatura. "Quero fazer esta" desce até o formulário já com a tarefa escrita, sem abrir programa de e-mail.
export default async function Voluntarios({ params }: PageProps<"/[lang]/voluntarios">) {
  const { lang, t } = await loadLang(params);
  return (
    <ContentPageView slug="voluntarios" lang={lang} t={t} tone="vermelho">
      <TarefasDeVoluntariado />
      <VolunteerForm s={t.volunteer} tarefas={voluntariado.tarefas.map(({ id, titulo }) => ({ id, titulo }))} />
    </ContentPageView>
  );
}
