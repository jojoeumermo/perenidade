// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { Suspense } from "react";
import { ComunidadeComRede } from "@/components/comunidade/ComunidadeComRede";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/comunidade">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/comunidade", t.community.title, t.community.lead);
}

/** A Comunidade: a Rede Lúcia (linha do tempo de posts curtos) e o fórum (tópicos por sala), numa página só. */
export default async function Comunidade({ params }: PageProps<"/[lang]/comunidade">) {
  const { t } = await loadLang(params);
  return (
    <div className="mx-auto max-w-6xl xl:max-w-[88rem] px-4 pt-6 pb-12">
      {/* Cabeçalho curto: numa rede, o conteúdo vem primeiro. */}
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1 border-b-[3px] border-ink pb-3">
        <div>
          <p className="rotulo">{t.community.eyebrow}</p>
          <h1 className="mt-1 font-serif text-4xl font-semibold leading-none">{t.community.title}</h1>
        </div>
        <p className="max-w-xl text-ink-soft">{t.community.lead}</p>
      </header>
      <Suspense>
        <ComunidadeComRede forum={t.community} rede={t.rede} />
      </Suspense>
    </div>
  );
}
