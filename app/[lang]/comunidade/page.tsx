// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { Suspense } from "react";
import { Forum } from "@/components/Forum";
import { Cartaz } from "@/components/Cartaz";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/comunidade">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/comunidade", t.community.title, t.community.lead);
}

/** Conversas: a lista com a barra de ferramentas presa no alto, as salas e as regras ao lado (ou recolhidas, no celular). */
export default async function Comunidade({ params }: PageProps<"/[lang]/comunidade">) {
  const { t } = await loadLang(params);
  return (
    <div className="mx-auto max-w-6xl xl:max-w-[88rem] px-4 py-12">
      <Cartaz eyebrow={t.community.eyebrow} title={t.community.title} slogan={t.slogans.comunidade} tone="vermelho">
        {t.community.lead}
      </Cartaz>
      <Suspense>
        <Forum s={t.community} />
      </Suspense>
    </div>
  );
}
