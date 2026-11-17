// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos da frente 11C (turma): i18n/rede/turma/{pt,en,es,fr,ru,zh}.json. O português é o texto final; os outros cinco são rascunho
// marcado ("_rascunho"). Cada idioma é um pedaço separado (import dinâmico): o navegador só baixa o que usa. A página lê daqui no
// servidor (o título). Sem "@/" de propósito (o teste lê daqui no Node).
import type pt from "../../../../i18n/rede/turma/pt.json";

export type TextosDaTurma = typeof pt;

const CARREGAR: Record<string, () => Promise<{ default: unknown }>> = {
  pt: () => import("../../../../i18n/rede/turma/pt.json"),
  en: () => import("../../../../i18n/rede/turma/en.json"),
  es: () => import("../../../../i18n/rede/turma/es.json"),
  fr: () => import("../../../../i18n/rede/turma/fr.json"),
  ru: () => import("../../../../i18n/rede/turma/ru.json"),
  zh: () => import("../../../../i18n/rede/turma/zh.json"),
};

/** Os textos do idioma pedido; idioma desconhecido cai no português. */
export async function carregarTextosDaTurma(lang: string): Promise<TextosDaTurma> {
  const carregar = CARREGAR[lang] ?? CARREGAR.pt;
  return (await carregar()).default as TextosDaTurma;
}
