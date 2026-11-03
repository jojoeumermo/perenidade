// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { PaginaDaFormatura } from "@/components/escola/formatura/PaginaDaFormatura";
import { RegistroDeFormatura } from "@/components/escola/formatura/RegistroDeFormatura";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { textosDaFormatura } from "@/i18n/escola/formatura";
import { cursosParaFormatura } from "@/lib/escola/formatura-servidor";
import { textosDaBase } from "@/lib/escola/textos";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const p = textosDaFormatura(lang).paginas.registro;
  return paginaMeta(lang, "/escola/formatura/registro", `${p.meta} · ${textosDaBase(lang).meta.titulo}`, p.lead);
}

/** O registro de formatura imprimível (E4-14): comprovante de estudo feito pela própria pessoa, sem valor de documento. */
export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await loadLang(params);
  const t = textosDaFormatura(lang);
  return (
    <PaginaDaFormatura lang={lang} texto={t.paginas.registro} voltarPara="/escola/formatura" voltarTexto={t.paginas.formatura.titulo} marca="registro">
      <RegistroDeFormatura s={t.registro} c={t.comum} cursos={cursosParaFormatura()} base={localePath(lang, "/escola")} idioma={lang} />
    </PaginaDaFormatura>
  );
}
