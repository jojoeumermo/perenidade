// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { Carteirinha } from "@/components/escola/carteirinha/Carteirinha";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { avisoDeMatricula, textosDaFormatura } from "@/i18n/escola/formatura";
import { cursosDoAparelho, textosDaMatricula } from "@/lib/escola/matricula-servidor";
import { textosDaBase } from "@/lib/escola/textos";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/escola/carteirinha">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const s = textosDaMatricula(lang);
  // Página de cada aparelho (sem conteúdo para a busca): fora do índice.
  return { ...paginaMeta(lang, "/escola/carteirinha", `${s.meta.carteirinha.titulo} · ${textosDaBase(lang).meta.titulo}`, s.meta.carteirinha.descricao), robots: { index: false, follow: true } };
}

/**
 * A carteirinha da Escola Revolucionária Lúcia Maria (E4-08, D1-10; docs/escola/matricula.md): gerada no aparelho, sem servidor, com o
 * aviso de que não é documento nem vale como carteira de estudante para meia-entrada (Lei nº 12.933/2013, art. 1º, § 2º).
 */
export default async function Page({ params }: PageProps<"/[lang]/escola/carteirinha">) {
  const { lang } = await loadLang(params);
  const s = textosDaMatricula(lang);
  const base = textosDaBase(lang);
  const titulos = Object.fromEntries(cursosDoAparelho().map((c) => [c.slug, c.titulo]));
  return (
    <div className="mx-auto max-w-5xl px-4 py-12" data-pagina-carteirinha="">
      <PageHeading eyebrow={s.comum.olho} title={s.meta.carteirinha.titulo} voltar={{ href: localePath(lang, "/escola/matricula"), texto: base.nav.matricula }}>
        {s.carteirinha.lead}
      </PageHeading>
      <Carteirinha s={s.carteirinha} comum={s.comum} aviso={avisoDeMatricula(textosDaFormatura(lang).comum)} titulos={titulos} lang={lang} />
    </div>
  );
}
