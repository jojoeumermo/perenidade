// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { PaginaDeApoio } from "@/components/apoie/PaginaDeApoio";
import { loadLang } from "@/i18n";
import { numerosDoSite } from "@/lib/apoio-numeros";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/apoie">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/apoie", t.support.title, t.support.lead);
}

/**
 * Apoie: a faixa vermelha com a meta, a escolha do tijolo (faixa e quanto ela vale), para onde vai o dinheiro e o
 * índice do resto: metas, o que já foi feito, como funciona, por que, outras formas de ajudar, o mural, as contas e as
 * perguntas. Os números vêm do painel (Apoio e transparência) ou de contagens do site.
 * A versão anterior desta página continua em /apoie/anterior.
 */
export default async function Apoie({ params }: PageProps<"/[lang]/apoie">) {
  const { lang, t } = await loadLang(params);
  return (
    <div className="pont">
      <div className="mx-auto max-w-[78rem] px-4 pt-10 pb-16 sm:px-6 lg:px-8 lg:pt-11">
        <PaginaDeApoio lang={lang} numeros={numerosDoSite()} s={t.support} slogan={t.slogans.apoie} />
      </div>
    </div>
  );
}
