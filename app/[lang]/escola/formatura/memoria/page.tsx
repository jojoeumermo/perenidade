// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { MemoriaDeFormatura } from "@/components/escola/formatura/MemoriaDeFormatura";
import { PaginaDaFormatura } from "@/components/escola/formatura/PaginaDaFormatura";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { textosDaFormatura } from "@/i18n/escola/formatura";
import { diaEmBrasilia } from "@/lib/escola/estudante";
import { type ItemDaMemoria, memoriaDeFormatura, validarMemoria } from "@/lib/escola/formatura";
import { cursosParaFormatura } from "@/lib/escola/formatura-servidor";
import { textosDaBase } from "@/lib/escola/textos";
import { paginaMeta } from "@/lib/seo";
import memoria from "@/content/escola/memoria-de-formatura.json";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const p = textosDaFormatura(lang).paginas.memoria;
  return paginaMeta(lang, "/escola/formatura/memoria", `${p.meta} · ${textosDaBase(lang).meta.titulo}`, p.lead);
}

/**
 * A memória de formatura (E4-14): lista curada pela coordenação em content/escola/memoria-de-formatura.json (só apelido,
 * com autorização e maioridade). A lista só vale inteira: um item com problema e a página não a mostra.
 */
export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await loadLang(params);
  const t = textosDaFormatura(lang);
  const cursos = cursosParaFormatura();
  const valida = validarMemoria(memoria, cursos).ok;
  const grupos = valida ? memoriaDeFormatura(memoria as ItemDaMemoria[], diaEmBrasilia(new Date())) : [];
  return (
    <PaginaDaFormatura lang={lang} texto={t.paginas.memoria} voltarPara="/escola/formatura" voltarTexto={t.paginas.formatura.titulo} marca="memoria">
      <MemoriaDeFormatura s={t.memoria} c={t.comum} grupos={grupos} listaValida={valida} cursos={cursos.map((c) => ({ slug: c.slug, titulo: c.titulo, sensivel: c.sensivel }))} contribuirHref={localePath(lang, "/contribuir")} />
    </PaginaDaFormatura>
  );
}
