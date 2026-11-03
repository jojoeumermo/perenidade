// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { PaginaDaFormatura } from "@/components/escola/formatura/PaginaDaFormatura";
import { ProjetoFinal } from "@/components/escola/formatura/ProjetoFinal";
import Link from "@/components/Link";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { textosDaFormatura } from "@/i18n/escola/formatura";
import { cursosParaFormatura } from "@/lib/escola/formatura-servidor";
import { textosDaBase } from "@/lib/escola/textos";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const p = textosDaFormatura(lang).paginas.projeto;
  return paginaMeta(lang, "/escola/formatura/projeto", `${p.meta} · ${textosDaBase(lang).meta.titulo}`, p.lead);
}

/** O guia do projeto final e as seis etapas (E4-14). Estática: um arquivo por idioma, sem página por curso. */
export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await loadLang(params);
  const t = textosDaFormatura(lang);
  const p = t.paginas.projeto;
  const base = localePath(lang, "/escola");
  return (
    <PaginaDaFormatura lang={lang} texto={p} voltarPara="/escola/formatura" voltarTexto={t.paginas.formatura.titulo} marca="projeto">
      <section aria-labelledby="projeto-guia">
        <h2 id="projeto-guia" className="formatura-h2">
          {p.guiaTitulo}
        </h2>
        <ol className="formatura-lista mt-3 list-decimal">
          {p.guia.map((passo) => (
            <li key={passo}>{passo}</li>
          ))}
        </ol>
      </section>
      <section aria-labelledby="projeto-ajuda">
        <h2 id="projeto-ajuda" className="formatura-h2">
          {p.orientacaoTitulo}
        </h2>
        <p className="mt-2">{p.orientacao}</p>
        <p className="mt-2">
          <Link href={localePath(lang, "/escola/turmas")} className="formatura-link">
            {p.linkTurmas}
          </Link>
        </p>
      </section>
      <ProjetoFinal s={t.projeto} g={t.gaveta} c={t.comum} cursos={cursosParaFormatura()} base={base} gavetaHref={localePath(lang, "/gaveta")} />
    </PaginaDaFormatura>
  );
}
