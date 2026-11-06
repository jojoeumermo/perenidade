// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos das telas novas da Alumia (Salvos e Fediverso): i18n/rede/alumia/{pt,en,es,fr,ru,zh}.json (pt é o final; os outros
// cinco são rascunho marcado). Carrega só o idioma pedido, sob demanda. Sem "@/" de propósito (roda no Node nos testes).
import type pt from "../../i18n/rede/alumia/pt.json";

export type TextosDaAlumia = typeof pt;

const CARREGAR: Record<string, () => Promise<{ default: unknown }>> = {
  pt: () => import("../../i18n/rede/alumia/pt.json"),
  en: () => import("../../i18n/rede/alumia/en.json"),
  es: () => import("../../i18n/rede/alumia/es.json"),
  fr: () => import("../../i18n/rede/alumia/fr.json"),
  ru: () => import("../../i18n/rede/alumia/ru.json"),
  zh: () => import("../../i18n/rede/alumia/zh.json"),
};

/** Os textos do idioma pedido; idioma desconhecido cai no português. */
export async function carregarTextosDaAlumia(lang: string): Promise<TextosDaAlumia> {
  const carregar = CARREGAR[lang] ?? CARREGAR.pt;
  return (await carregar()).default as TextosDaAlumia;
}
