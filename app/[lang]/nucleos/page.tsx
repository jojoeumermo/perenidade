// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "@/components/Link";
import { NucleosPublicos } from "@/components/NucleosPublicos";
import { Capa, Corpo, Secao } from "@/components/pagina/Capa";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/nucleos">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/nucleos", t.nucleos.eyebrow, t.nucleos.lead);
}

/** Os núcleos de estudo que quiseram aparecer, e como montar um: a escola sai da tela. */
export default async function Nucleos({ params }: PageProps<"/[lang]/nucleos">) {
  const { lang, t } = await loadLang(params);
  const s = t.nucleos;
  const to = (path: string) => localePath(lang, path);
  return (
    <>
      <Capa rotulo={s.eyebrow} titulo={s.title}>{s.lead}</Capa>
      <Corpo largura="media">
        <NucleosPublicos s={s} />

        <Secao titulo={s.montarTitulo} tarja="vermelha" className="mt-16">
          <p className="mt-4 max-w-3xl font-serif text-xl leading-relaxed">{s.montarTexto}</p>
          <p className="mt-5 flex flex-wrap gap-3">
            <Link href={to("/trilhas")} className="botao botao-prelo">{s.escolherTrilha}</Link>
            <Link href={to("/despertar")} className="botao">{s.despertar}</Link>
          </p>
        </Secao>

        <Secao titulo={s.aparecerTitulo} className="mt-14">
          <p className="mt-4 max-w-3xl font-serif text-lg leading-relaxed">{s.aparecerTexto}</p>
          <p className="mt-4 max-w-3xl border-l-4 border-[#c21f16] pl-4 font-sans text-sm">{s.seguranca}</p>
        </Secao>
      </Corpo>
    </>
  );
}
