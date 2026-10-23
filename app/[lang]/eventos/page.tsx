// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
import { redirect } from "next/navigation";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";

// A agenda de encontros (cineclube, clube de leitura) está guardada para quando o instituto tiver muita gente: o
// conteúdo continua em content/eventos.json e components/governanca/Agenda.tsx. Por enquanto o endereço leva às aulas
// ao vivo, o encontro que já acontece. Redirecionamento temporário (307): a página volta.
export default async function Eventos({ params }: PageProps<"/[lang]/eventos">) {
  const { lang } = await loadLang(params);
  redirect(localePath(lang, "/ao-vivo"));
}
