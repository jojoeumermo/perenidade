// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos da frente 13B (mapa): i18n/rede/mapa/{pt,en,es,fr,ru,zh}.json. O português é o texto final; os outros cinco são rascunho
// marcado ("_rascunho"). Cada idioma é um pedaço separado (import dinâmico): o navegador só baixa o que usa. Sem "@/" de propósito.
import type pt from "../../../i18n/rede/mapa/pt.json";
import { carregarPronto } from "../../../lib/rede/textos-prontos";

export type TextosDoMapa = typeof pt;

const CARREGAR: Record<string, () => Promise<{ default: unknown }>> = {
  pt: () => import("../../../i18n/rede/mapa/pt.json"),
  en: () => import("../../../i18n/rede/mapa/en.json"),
  es: () => import("../../../i18n/rede/mapa/es.json"),
  fr: () => import("../../../i18n/rede/mapa/fr.json"),
  ru: () => import("../../../i18n/rede/mapa/ru.json"),
  zh: () => import("../../../i18n/rede/mapa/zh.json"),
};

/** Os textos do idioma pedido; idioma desconhecido cai no português. */
export async function carregarTextosDoMapa(lang: string): Promise<TextosDoMapa> {
  return (await carregarPronto(CARREGAR, lang)) as TextosDoMapa;
}
