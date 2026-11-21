// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Estante, { generateMetadata as metaDaEstante } from "@/app/[lang]/estantes/[area]/page";
import { VoltarAsAulasAbertas } from "@/components/escola/aulas/VoltarAsAulasAbertas";
import { loadLang } from "@/i18n";
import { textosDasAulasAbertas } from "@/i18n/escola/aulas";
import { GRUPOS_DA_ESCOLA_ABERTA, areaNaEscola } from "@/lib/escola/aulas-abertas";
import { withLangs } from "@/lib/params";
import "@/styles/escola-aulas.css";

type Props = PageProps<"/[lang]/escola/aulas/[area]">;

/** Os mesmos parâmetros (lang, area): a página do site recebe o pedido como se fosse dela. */
const comoNoSite = (props: Props) => props as unknown as PageProps<"/[lang]/estantes/[area]">;

export const dynamicParams = false;

export function generateStaticParams() {
  return withLangs([...GRUPOS_DA_ESCOLA_ABERTA.teoria, ...GRUPOS_DA_ESCOLA_ABERTA.lutas].filter(areaNaEscola).map((area) => ({ area })));
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  return areaNaEscola((await props.params).area) ? metaDaEstante(comoNoSite(props)) : {};
}

/**
 * /escola/aulas/[area] (P5, B2): a página da disciplina de Teoria revolucionária ou de Lutas do povo, que saiu de /estantes e
 * mora na Escola. É a MESMA página do site (trilhas, obras, materiais avulsos, vídeos, laboratórios: nada sumiu), na moldura da
 * Escola, aberta sem conta. O endereço antigo vem para cá com 301 (proxy.ts).
 */
export default async function EstanteNaEscola(props: Props) {
  const { lang } = await loadLang(props.params);
  if (!areaNaEscola((await props.params).area)) notFound();
  return (
    <div className="efl-pagina">
      <VoltarAsAulasAbertas lang={lang} texto={textosDasAulasAbertas(lang).voltar} />
      <Estante {...comoNoSite(props)} />
    </div>
  );
}
