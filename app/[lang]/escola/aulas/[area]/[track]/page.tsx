// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Trilha, { generateMetadata as metaDaTrilha } from "@/app/[lang]/trilhas/[track]/page";
import { VoltarAsAulasAbertas } from "@/components/escola/aulas/VoltarAsAulasAbertas";
import { loadLang } from "@/i18n";
import { defaultLocale } from "@/i18n/config";
import { textosDasAulasAbertas } from "@/i18n/escola/aulas";
import { getTracks } from "@/lib/content";
import { areaDaTrilhaNaEscola, areaNaEscola } from "@/lib/escola/aulas-abertas";
import { withLangs } from "@/lib/params";
import "@/styles/escola-aulas.css";

type Props = PageProps<"/[lang]/escola/aulas/[area]/[track]">;

/** Os mesmos parâmetros (lang, track; area a mais): a página do site recebe o pedido como se fosse dela. */
const comoNoSite = (props: Props) => props as unknown as PageProps<"/[lang]/trilhas/[track]">;

export const dynamicParams = false;

export function generateStaticParams() {
  return withLangs(getTracks(defaultLocale).filter((tr) => areaNaEscola(tr.area)).map((tr) => ({ area: tr.area, track: tr.slug })));
}

/** A trilha pedida mora na Escola, debaixo DESTA disciplina? (/escola/aulas/marxismo/<trilha de outra> dá 404.) */
async function daqui(props: Props): Promise<boolean> {
  const { area, track } = await props.params;
  return areaNaEscola(area) && areaDaTrilhaNaEscola(track) === area;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  return (await daqui(props)) ? metaDaTrilha(comoNoSite(props)) : {};
}

/**
 * /escola/aulas/[area]/[track] (P5, B2): a página da trilha, a MESMA de /trilhas/[track] (roteiro, prova, kit de núcleo, guardar
 * para ler sem internet, compartilhar), na moldura da Escola, aberta sem conta. O endereço antigo vem para cá com 301.
 */
export default async function TrilhaNaEscola(props: Props) {
  const { lang } = await loadLang(props.params);
  if (!(await daqui(props))) notFound();
  return (
    <div className="efl-pagina">
      <VoltarAsAulasAbertas lang={lang} texto={textosDasAulasAbertas(lang).voltar} />
      <Trilha {...comoNoSite(props)} />
    </div>
  );
}
