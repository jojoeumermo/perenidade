// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
import { permanentRedirect } from "next/navigation";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";

// "Voluntarie-se" virou uma parte da página "Voluntários" (as tarefas rápidas, logo antes da candidatura).
export default async function VoluntarieSe({ params }: PageProps<"/[lang]/voluntarie-se">) {
  const { lang } = await loadLang(params);
  permanentRedirect(`${localePath(lang, "/voluntarios")}#tarefas`);
}
