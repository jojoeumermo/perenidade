// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { PaginaDaFormatura } from "@/components/escola/formatura/PaginaDaFormatura";
import { PainelDeFormatura } from "@/components/escola/formatura/PainelDeFormatura";
import Link from "@/components/Link";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { textosDaFormatura } from "@/i18n/escola/formatura";
import { cursosParaFormatura } from "@/lib/escola/formatura-servidor";
import { textosDaBase } from "@/lib/escola/textos";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const p = textosDaFormatura(lang).paginas.formatura;
  return paginaMeta(lang, "/escola/formatura", `${p.meta} · ${textosDaBase(lang).meta.titulo}`, p.lead);
}

/**
 * O hub do projeto final e da formatura (E4-14): o critério (aulas feitas mais as etapas do projeto), a marcação da
 * formatura e a oferta de publicar o projeto na Gaveta Aberta. Conferência de "feito / falta", sem nota.
 */
export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await loadLang(params);
  const t = textosDaFormatura(lang);
  const base = localePath(lang, "/escola");
  const p = t.paginas.formatura;
  const atalhos = [
    ["/escola/formatura/projeto", p.projeto],
    ["/escola/formatura/registro", p.registro],
    ["/escola/formatura/mural", p.mural],
    ["/escola/formatura/memoria", p.memoria],
    ["/escola/caderneta", p.caderneta],
  ] as const;
  return (
    <PaginaDaFormatura lang={lang} texto={p} marca="formatura">
      <PainelDeFormatura s={t.formatura} cer={t.cerimonia} g={t.gaveta} c={t.comum} cursos={cursosParaFormatura()} base={base} gavetaHref={localePath(lang, "/gaveta")} idioma={lang} />
      <nav aria-labelledby="formatura-atalhos">
        <h2 id="formatura-atalhos" className="formatura-h2">
          {p.atalhos}
        </h2>
        <ul className="formatura-lista">
          {atalhos.map(([caminho, texto]) => (
            <li key={caminho}>
              <Link href={localePath(lang, caminho)} className="formatura-link">
                {texto}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </PaginaDaFormatura>
  );
}
