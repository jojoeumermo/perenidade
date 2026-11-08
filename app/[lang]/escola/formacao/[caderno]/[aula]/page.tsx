// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AulaDaEscola, type AulaParaAEscola } from "@/components/escola/aula/AulaDaEscola";
import { cadernoVisto } from "@/components/escola/formacao/vista";
import { loadLang } from "@/i18n";
import type { Locale } from "@/i18n/config";
import { textosDaFormacao } from "@/i18n/escola/formacao";
import { textosDaFormacaoBase } from "@/i18n/escola/formacao-base";
import { getTrack } from "@/lib/content";
import { cadernoPorSlug, lessonIdDoPedaco } from "@/lib/escola/contratos";
import { preencher } from "@/lib/escola/textos";
import { paginaMeta } from "@/lib/seo";
import "@/components/escola/formacao/formacao.css";
import "@/styles/escola-aula.css";
import "@/styles/escola-leveza.css";

type Props = PageProps<"/[lang]/escola/formacao/[caderno]/[aula]">;

// Montada na primeira visita e guardada (um dia), como a zine e o kit de núcleo das trilhas: são centenas de aulas (os
// cadernos 01 e 11 juntam aulas de várias trilhas) e a Escola não precisa delas prontas na montagem do site.
export const revalidate = 86400;
export const dynamicParams = true;

export function generateStaticParams() {
  return [];
}

/** A aula de um caderno, se ela existe e está pronta (a mesma de /trilhas, pelo lessonId). */
function acharAula(lang: Locale, slugDoCaderno: string, pedaco: string, despertar: string): AulaParaAEscola | null {
  const contrato = cadernoPorSlug(slugDoCaderno);
  if (!contrato) return null;
  const caderno = cadernoVisto(lang, slugDoCaderno, textosDaFormacaoBase(lang).hoje.cadernos, despertar);
  const id = lessonIdDoPedaco(contrato, pedaco);
  const aula = caderno?.prontas.find((a) => a.id === id);
  if (!caderno || !aula) return null;
  const [trilha, slug] = id.split("/");
  const track = getTrack(trilha, lang);
  const lesson = track?.lessons.find((l) => l.slug === slug);
  return track && lesson ? { caderno, aula, track, lesson } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  const { caderno, aula } = await params;
  const achada = acharAula(lang, caderno, aula, t.despertar.lead);
  if (!achada) return {};
  const tf = textosDaFormacao(lang);
  return {
    ...paginaMeta(lang, achada.aula.href ?? `/escola/formacao/${caderno}`, preencher(tf.meta.aula, { codigo: achada.aula.codigo ?? "", titulo: achada.lesson.title }), achada.lesson.summary),
    robots: { index: false },
  };
}

/**
 * /escola/formacao/[caderno]/[aula] (prancha Aula): a aula do caderno dentro da Escola, com tudo o que a aula de /trilhas
 * tem (components/escola/aula/AulaDaEscola.tsx) e o MESMO lessonId. O pedaço do endereço segue o contrato da F1
 * (lib/escola/contratos.ts, pedacoDaAula): o slug da aula, ou "trilha--aula" nos cadernos montados com várias trilhas.
 * Só militante vê (a porta do layout decide); o texto é o mesmo, público, de /trilhas.
 */
export default async function AulaDoCaderno({ params }: Props) {
  const { lang, t } = await loadLang(params);
  const { caderno, aula } = await params;
  const achada = acharAula(lang, caderno, aula, t.despertar.lead);
  if (!achada) notFound();
  return <AulaDaEscola lang={lang} t={t} tf={textosDaFormacao(lang)} dados={achada} />;
}
