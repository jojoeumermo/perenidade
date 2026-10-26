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
    <div className="pb-8">
      {/* Na tela, a Rede tem a própria marca (o desenho do RedeLucia); o título da página fica para o leitor de tela. */}
      <h1 className="sr-only">{t.community.title}</h1>
      <Suspense>
        <ComunidadeComRede forum={t.community} rede={t.rede} />
      </Suspense>
    </div>
  );
}
