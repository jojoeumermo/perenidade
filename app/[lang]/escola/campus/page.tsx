// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { MapaDoCampus } from "@/components/escola/campus/MapaDoCampus";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { campusDoSite, textosDoCampus } from "@/lib/escola/campus-servidor";
import { textosDaBase } from "@/lib/escola/textos";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/escola/campus">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const s = textosDoCampus(lang);
  return paginaMeta(lang, "/escola/campus", `${s.meta.campus.titulo} · ${textosDaBase(lang).meta.titulo}`, s.meta.campus.descricao);
}

/**
 * O mapa do campus (E4-09, D1-1; docs/escola/campus.md): os mesmos prédios do "Mais", numa página que funciona sem
 * JavaScript. O carimbo do passaporte e a busca chegam com o JavaScript, lidos e feitos só no aparelho.
 */
export default async function Page({ params }: PageProps<"/[lang]/escola/campus">) {
  const { lang, t } = await loadLang(params);
  const s = textosDoCampus(lang);
  return (
    <div className="mx-auto max-w-6xl px-4 py-12" data-pagina-campus="">
      <PageHeading eyebrow={s.comum.olho} title={s.meta.campus.titulo} voltar={{ href: localePath(lang, "/escola"), texto: s.comum.voltar }}>
        {s.meta.campus.descricao}
      </PageHeading>
      <div className="mt-8">
        <MapaDoCampus predios={campusDoSite(lang, t)} s={s.mapa} comBusca />
      </div>
    </div>
  );
}
