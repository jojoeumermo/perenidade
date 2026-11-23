// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Aula, { generateMetadata as metaDaAula } from "@/app/[lang]/trilhas/[track]/[lesson]/page";
import { loadLang } from "@/i18n";
import { areaDaTrilhaNaEscola, areaNaEscola } from "@/lib/escola/aulas-abertas";
import "@/styles/escola-aulas.css";

type Props = PageProps<"/[lang]/escola/aulas/[area]/[track]/[lesson]">;

// Montada na primeira visita e guardada (um dia), como as aulas dos cadernos da Formação: são quase 500 aulas em 6 idiomas, e a
// montagem do site não precisa delas prontas. A aula em outro idioma sem tradução vai para a de português (a própria página).
/** Os mesmos parâmetros (lang, track, lesson; area a mais): a página do site recebe o pedido como se fosse dela. */
const comoNoSite = (props: Props) => props as unknown as PageProps<"/[lang]/trilhas/[track]/[lesson]">;

export const revalidate = 86400;
export const dynamicParams = true;

export function generateStaticParams() {
  return [];
}

async function daqui(props: Props): Promise<boolean> {
  const { area, track } = await props.params;
  return areaNaEscola(area) && areaDaTrilhaNaEscola(track) === area;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  return (await daqui(props)) ? metaDaAula(comoNoSite(props)) : {};
}

/**
 * /escola/aulas/[area]/[track]/[lesson] (P5, B2): a aula de Teoria revolucionária ou de Lutas do povo, que saiu de /trilhas e
 * mora na Escola. É a MESMA aula, com o MESMO lessonId: progresso, anotações, salvos e exercícios de quem já estudou continuam
 * valendo (moram no aparelho, neste mesmo endereço). Aberta sem conta, sem registro de quem leu. O endereço antigo vem para cá
 * com 301 (proxy.ts); o texto puro (/texto), o cordel e a zine continuam no endereço de /trilhas.
 */
export default async function AulaNaEscola(props: Props) {
  await loadLang(props.params);
  if (!(await daqui(props))) notFound();
  return (
    <div className="efl-pagina">
      <Aula {...comoNoSite(props)} />
    </div>
  );
}
