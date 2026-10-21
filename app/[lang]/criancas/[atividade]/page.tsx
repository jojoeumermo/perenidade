// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AreaInfantil } from "@/components/criancas/AreaInfantil";
import { ATIVIDADES, type AtividadeId } from "@/components/criancas/atividades";
import { loadLang } from "@/i18n";
import { withLangs } from "@/lib/params";
import { paginaMeta } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return withLangs(ATIVIDADES.map((a) => ({ atividade: a.id })));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/criancas/[atividade]">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const { atividade } = await params;
  const a = ATIVIDADES.find((x) => x.id === atividade);
  return a ? paginaMeta(lang, `/criancas/${a.id}`, `${a.nome} · Cantinho da Lua`, `${a.texto} ${a.idade}.`) : {};
}

export default async function Atividade({ params }: PageProps<"/[lang]/criancas/[atividade]">) {
  const { lang } = await loadLang(params);
  const id = (await params).atividade;
  if (!ATIVIDADES.some((a) => a.id === id)) notFound();
  return <AreaInfantil lang={lang} atividade={id as AtividadeId} />;
}
