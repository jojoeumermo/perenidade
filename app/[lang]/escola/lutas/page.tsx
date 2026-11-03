// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { LutasDoAno } from "@/components/escola/vida/LutasDoAno";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { textosDaVida } from "@/i18n/escola/vida";
import { calendarioAindaProposto, FERIADOS } from "@/lib/escola/calendario";
import { type FatoDeLuta, lutasDoAno } from "@/lib/escola/lutas";
import { textosDaBase } from "@/lib/escola/textos";
import { paginaMeta } from "@/lib/seo";
import nesteDia from "@/content/neste-dia.json";
import "@/styles/escola-vida.css";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const s = textosDaVida(lang);
  return paginaMeta(lang, "/escola/lutas", `${s.meta.lutas.titulo} · ${textosDaBase(lang).meta.titulo}`, s.meta.lutas.descricao);
}

/**
 * Mapa das lutas (E4-11): as 8 datas de luta que já são feriados do campus (E4-09) mais os fatos de "Neste dia" da mesma
 * data, por mês. Página estática, sem parâmetros: o servidor cruza os dois arquivos e passa só as datas e os fatos.
 */
export default async function Page({ params }: Props) {
  const { lang } = await loadLang(params);
  const s = textosDaVida(lang);
  const lutas = lutasDoAno(FERIADOS, nesteDia.fatos as FatoDeLuta[]);
  return (
    <div className="mx-auto max-w-4xl px-4 py-12" data-pagina-vida="lutas">
      <PageHeading eyebrow={s.lutas.olho} title={s.lutas.titulo} voltar={{ href: localePath(lang, "/escola/vida"), texto: s.comum.voltarVida }}>
        {s.lutas.lead}
      </PageHeading>
      <LutasDoAno lutas={lutas} s={s.lutas} lang={lang} proposto={calendarioAindaProposto() ? textosDaBase(lang).calendario.proposto : null} />
    </div>
  );
}