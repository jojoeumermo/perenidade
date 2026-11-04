// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// "Discutir esta aula" (R4, item 38): o botão da página da aula (só com o recurso rede-v2 ligado) leva à comunidade da disciplina
// filtrada pela aula. Puro e minúsculo de propósito: a página da aula é um componente de servidor, e este módulo não lê disco nem
// traz os dicionários da Rede. Sem "@/" de propósito (roda no Node nos testes).

const ROTULOS: Record<string, string> = {
  pt: "Discutir esta aula na Rede",
  en: "Discuss this lesson in the Network",
  es: "Discutir esta clase en la Red",
  fr: "Discuter ce cours dans le Réseau",
  ru: "Обсудить этот урок в Сети",
  zh: "在网络中讨论这节课",
};

export const rotuloDiscutirAula = (lang: string): string => ROTULOS[lang] ?? ROTULOS.pt;

/** A disciplina "trabalho" (Educação para o trabalho) ficou com a comunidade "oficios-e-trabalho"; "trabalho" é a luta sindical. */
const COMUNIDADE_DA_DISCIPLINA: Record<string, string> = { trabalho: "oficios-e-trabalho" };

/** O endereço relativo (já com o idioma), ou nulo se algum pedaço não serve para URL (nunca deveria acontecer com slugs do site). */
export function enderecoDiscutirAula(lang: string, trilha: string, aula: string, disciplina: string): string | null {
  const ok = (s: string) => /^[a-z0-9-]{2,80}$/.test(s);
  if (!ok(trilha) || !ok(aula) || !ok(disciplina)) return null;
  return `/${lang}/comunidade/aula/${trilha}/${aula}?c=${COMUNIDADE_DA_DISCIPLINA[disciplina] ?? disciplina}`;
}
