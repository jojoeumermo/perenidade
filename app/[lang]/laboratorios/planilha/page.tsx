// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { permanentRedirect } from "next/navigation";
import { localePath } from "@/i18n/config";
import { loadLang } from "@/i18n";

/** A planilha virou o laboratório de escritório (GridCraft, com o WordCraft e o DeckCraft): o endereço antigo leva para lá. */
export default async function Page({ params }: PageProps<"/[lang]/laboratorios/planilha">) {
  const { lang } = await loadLang(params);
  permanentRedirect(localePath(lang, "/laboratorios/escritorio"));
}
