// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos da frente 11C (agenda): i18n/rede/agenda/{pt,en,es,fr,ru,zh}.json. O português é o texto final; os outros cinco são rascunho
// marcado ("_rascunho"). Cada idioma é um pedaço separado (import dinâmico): o navegador só baixa o que usa. A página lê daqui no
// servidor (o título). Sem "@/" de propósito (o teste lê daqui no Node).
import type pt from "../../../../i18n/rede/agenda/pt.json";

export type TextosDaAgenda = typeof pt;

const CARREGAR: Record<string, () => Promise<{ default: unknown }>> = {
  pt: () => import("../../../../i18n/rede/agenda/pt.json"),
  en: () => import("../../../../i18n/rede/agenda/en.json"),
  es: () => import("../../../../i18n/rede/agenda/es.json"),
  fr: () => import("../../../../i18n/rede/agenda/fr.json"),
  ru: () => import("../../../../i18n/rede/agenda/ru.json"),
  zh: () => import("../../../../i18n/rede/agenda/zh.json"),
};

/** Os textos do idioma pedido; idioma desconhecido cai no português. */
export async function carregarTextosDaAgenda(lang: string): Promise<TextosDaAgenda> {
  const carregar = CARREGAR[lang] ?? CARREGAR.pt;
  return (await carregar()).default as TextosDaAgenda;
}
