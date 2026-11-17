// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// "Discutir na Alumia" (R4, item 38; onda 11, L2-50): o botão da página da aula leva ao tópico daquela aula na comunidade de estudo
// da disciplina. O botão (components/rede/estudo/conquistas/DiscutirNaAlumia.tsx) só aparece com a Alumia aberta, fora do
// aplicativo do Instituto e para quem tem conta aprovada na Alumia. Puro e minúsculo de propósito: a página da aula é um componente
// de servidor, e este módulo não lê disco nem traz os dicionários da Rede. Sem "@/" de propósito (roda no Node nos testes).
import { ligado, RECURSOS, type Recurso } from "../recursos";
import { ALUMIA_URL, enderecoDaAlumia } from "./alumia";

const ROTULOS: Record<string, string> = {
  pt: "Discutir esta aula na Alumia",
  en: "Discuss this lesson on Alumia",
  es: "Discutir esta clase en Alumia",
  fr: "Discuter ce cours sur Alumia",
  ru: "Обсудить этот урок в Alumia",
  zh: "在 Alumia 讨论这节课",
};

export const rotuloDiscutirAula = (lang: string): string => ROTULOS[lang] ?? ROTULOS.pt;

/** A disciplina "trabalho" (Educação para o trabalho) ficou com a comunidade "oficios-e-trabalho"; "trabalho" é a luta sindical. */
const COMUNIDADE_DA_DISCIPLINA: Record<string, string> = { trabalho: "oficios-e-trabalho" };

/**
 * O endereço do tópico da aula (já com o idioma), ou nulo se algum pedaço não serve para URL (nunca deveria acontecer com slugs do
 * site). Com o endereço próprio da Alumia ligado, vai para lá; sem ele, /[lang]/alumia/aula/….
 */
export function enderecoDiscutirAula(lang: string, trilha: string, aula: string, disciplina: string, base: string = ALUMIA_URL): string | null {
  const ok = (s: string) => /^[a-z0-9-]{2,80}$/.test(s);
  if (!ok(trilha) || !ok(aula) || !ok(disciplina)) return null;
  return enderecoDaAlumia(lang, `/aula/${trilha}/${aula}?c=${COMUNIDADE_DA_DISCIPLINA[disciplina] ?? disciplina}`, base);
}

/**
 * A Alumia está aberta para o botão da aula? Precisa da Rede v2 e, quando a montagem conhece o recurso "alumia-aberta" (o aviso de
 * "em construção" que cobre a Alumia até o SQL final), dele também. Sem esse recurso na montagem, a Alumia não tem aviso de
 * construção e vale só a Rede v2. `lista` e `conhecidos` existem para o teste.
 */
export function alumiaAbertaParaAula(lista?: Set<string>, conhecidos: readonly string[] = Object.keys(RECURSOS)): boolean {
  if (!ligado("rede-v2", lista)) return false;
  if (!conhecidos.includes("alumia-aberta")) return true;
  return ligado("alumia-aberta" as Recurso, lista);
}
