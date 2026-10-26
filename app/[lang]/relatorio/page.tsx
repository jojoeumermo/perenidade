// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "@/components/Link";
import { Capa, Corpo, Secao } from "@/components/pagina/Capa";
import { RelatorioTrimestral } from "@/components/RelatorioTrimestral";
import { loadLang } from "@/i18n";
import { fill, localePath } from "@/i18n/config";
import { numerosDoSite } from "@/lib/apoio-numeros";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/relatorio">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/relatorio", t.relatorio.titulo, t.relatorio.lead);
}

/** Prestação de contas a cada trimestre: o que foi feito, em números conferíveis, e para onde foi o dinheiro. */
export default async function Relatorio({ params }: PageProps<"/[lang]/relatorio">) {
  const { lang, t } = await loadLang(params);
  const s = t.relatorio;
  const site = numerosDoSite();
  const n = (v: number) => new Intl.NumberFormat(lang).format(v);
  return (
    <>
      <Capa rotulo={s.rotulo} titulo={s.titulo}>{s.lead}</Capa>
      <Corpo largura="media">
        <RelatorioTrimestral lang={lang} s={s} />

        <Secao titulo={s.acervoTitulo} className="mt-16">
          <p className="mt-4 max-w-3xl font-serif text-xl leading-relaxed">
            {fill(s.acervoTexto, { aulas: n(site.aulas), obras: n(site.obras), traducoes: n(site.traducoes), idiomas: site.idiomas })}
          </p>
        </Secao>

        <Secao titulo={s.comoTitulo} tarja="vermelha" className="mt-14">
          <p className="mt-4 max-w-3xl font-serif text-lg leading-relaxed">{s.comoTexto}</p>
          <p className="mt-5 flex flex-wrap gap-3">
            <Link href={localePath(lang, "/apoie")} className="botao botao-prelo">{s.verContas}</Link>
            <Link href={localePath(lang, "/historico")} className="botao">{s.historico}</Link>
          </p>
        </Secao>
      </Corpo>
    </>
  );
}
