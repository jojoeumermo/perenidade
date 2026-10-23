// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
import { permanentRedirect } from "next/navigation";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";

// O kit de divulgação agora mora em "Materiais para imprimir", junto com os zines e cartazes da coordenação.
export default async function Divulgue({ params }: PageProps<"/[lang]/divulgue">) {
  const { lang } = await loadLang(params);
  permanentRedirect(`${localePath(lang, "/materiais")}#kit`);
}
