// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { AnuncioDoMural } from "@/components/escola/formatura/AnuncioDoMural";
import { PaginaDaFormatura } from "@/components/escola/formatura/PaginaDaFormatura";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { textosDaFormatura } from "@/i18n/escola/formatura";
import { cursosParaFormatura } from "@/lib/escola/formatura-servidor";
import { textosDaBase } from "@/lib/escola/textos";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const p = textosDaFormatura(lang).paginas.mural;
  return paginaMeta(lang, "/escola/formatura/mural", `${p.meta} · ${textosDaBase(lang).meta.titulo}`, p.lead);
}

/** O texto do anúncio no Mural dos Trabalhadores (E4-14). A pessoa copia e envia pelo formulário do Mural, que modera. */
export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await loadLang(params);
  const t = textosDaFormatura(lang);
  return (
    <PaginaDaFormatura lang={lang} texto={t.paginas.mural} voltarPara="/escola/formatura" voltarTexto={t.paginas.formatura.titulo} marca="mural">
      <AnuncioDoMural s={t.mural} c={t.comum} cursos={cursosParaFormatura().map((c) => ({ slug: c.slug, titulo: c.titulo }))} muralHref={localePath(lang, "/mural")} base={localePath(lang, "/escola")} />
    </PaginaDaFormatura>
  );
}
