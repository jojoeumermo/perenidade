// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos da frente 13B (aovivo): i18n/rede/aovivo/{pt,en,es,fr,ru,zh}.json. O português é o texto final; os outros cinco são rascunho
// marcado ("_rascunho"). Cada idioma é um pedaço separado (import dinâmico): o navegador só baixa o que usa. Sem "@/" de propósito.
import type pt from "../../../i18n/rede/aovivo/pt.json";

export type TextosDoAoVivo = typeof pt;

const CARREGAR: Record<string, () => Promise<{ default: unknown }>> = {
  pt: () => import("../../../i18n/rede/aovivo/pt.json"),
  en: () => import("../../../i18n/rede/aovivo/en.json"),
  es: () => import("../../../i18n/rede/aovivo/es.json"),
  fr: () => import("../../../i18n/rede/aovivo/fr.json"),
  ru: () => import("../../../i18n/rede/aovivo/ru.json"),
  zh: () => import("../../../i18n/rede/aovivo/zh.json"),
};

/** Os textos do idioma pedido; idioma desconhecido cai no português. */
export async function carregarTextosDoAoVivo(lang: string): Promise<TextosDoAoVivo> {
  const carregar = CARREGAR[lang] ?? CARREGAR.pt;
  return (await carregar()).default as TextosDoAoVivo;
}
