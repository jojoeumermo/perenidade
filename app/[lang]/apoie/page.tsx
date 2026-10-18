// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { PaginaDeApoio } from "@/components/apoie/PaginaDeApoio";
import { Cartaz } from "@/components/Cartaz";
import { loadLang } from "@/i18n";
import { numerosDoSite } from "@/lib/apoio-numeros";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/apoie">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/apoie", t.support.title, t.support.lead);
}

/**
 * Apoie: o botão na primeira tela, como funciona, faixas, metas, para onde vai o dinheiro, o que já foi feito, outras
 * formas de ajudar, o mural e a transparência. Os números vêm do painel (Apoio e transparência) ou de contagens do site.
 * A versão anterior desta página continua em /apoie/anterior.
 */
export default async function Apoie({ params }: PageProps<"/[lang]/apoie">) {
  const { lang, t } = await loadLang(params);
  const s = t.support;
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <Cartaz eyebrow={s.eyebrow} title={s.title} slogan={t.slogans.apoie} tone="raios">
        {s.lead}
      </Cartaz>
      <PaginaDeApoio lang={lang} numeros={numerosDoSite()} s={s} />
    </div>
  );
}
