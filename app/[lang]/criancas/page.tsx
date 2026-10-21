// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { AreaInfantil } from "@/components/criancas/AreaInfantil";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/criancas">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  return paginaMeta(lang, "/criancas", "Cantinho da Lua: área infantil", "Brincadeiras para aprender de 4 a 12 anos: letras, histórias, contas, programação, internet segura e folhas para imprimir. Sem conta, sem anúncio e sem placar.");
}

export default async function Criancas({ params }: PageProps<"/[lang]/criancas">) {
  const { lang } = await loadLang(params);
  return <AreaInfantil lang={lang} />;
}
