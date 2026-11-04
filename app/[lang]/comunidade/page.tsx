// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { Suspense } from "react";
import { ComunidadeComRede } from "@/components/comunidade/ComunidadeComRede";
import { loadLang } from "@/i18n";
import { pickSections } from "@/i18n/core";
import { I18nProvider } from "@/components/I18n";
import { RedeSobDemanda } from "@/components/rede/RedeSobDemanda";
import { textosDaRede } from "@/lib/rede/textos";
import { textosDosConsertos } from "@/lib/rede/textos-consertos";
import { ligado } from "@/lib/recursos";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/comunidade">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/comunidade", t.community.title, t.community.lead);
}

/** A Comunidade: a Rede Lúcia (linha do tempo de posts curtos) e o fórum (tópicos por sala), numa página só. */
export default async function Comunidade({ params }: PageProps<"/[lang]/comunidade">) {
  const { lang, t } = await loadLang(params);
  // Recurso "rede-v2" (só liga pelo nome): a Rede e o Fórum numa só, carregada sob demanda. Desligado, a Rede de hoje fica como está.
  if (ligado("rede-v2")) {
    return (
      <div className="pb-8">
        <h1 className="sr-only">{t.community.title}</h1>
        <Suspense>
          <RedeSobDemanda lang={lang} s={textosDaRede(lang)} tela={{ tipo: "linha", aba: "tudo" }} />
        </Suspense>
      </div>
    );
  }
  return (
    <div className="pb-8">
      {/* Na tela, a Rede tem a própria marca (o desenho do RedeLucia); o título da página fica para o leitor de tela. */}
      <h1 className="sr-only">{t.community.title}</h1>
      <Suspense>
        <I18nProvider lang={lang} t={pickSections(t, ["areas"])}><ComunidadeComRede forum={t.community} rede={t.rede} consertos={textosDosConsertos(lang)} /></I18nProvider>
      </Suspense>
    </div>
  );
}
