// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos da página de baixar e conferir o app e do aviso "Para conversar, use o app" (onda R3, item 1.2):
// i18n/rede/app/{pt,en,es,fr,ru,zh}.json. O português é o texto final; os outros cinco são rascunho marcado ("_rascunho") e,
// enquanto forem, quem escolheu outro idioma lê o português (lib/rede/textos-prontos.ts). Sem "@/" de propósito.
import type pt from "../../../i18n/rede/app/pt.json";
import { carregarPronto } from "../../../lib/rede/textos-prontos";

export type TextosDoApp = typeof pt;

const CARREGAR: Record<string, () => Promise<{ default: unknown }>> = {
  pt: () => import("../../../i18n/rede/app/pt.json"),
  en: () => import("../../../i18n/rede/app/en.json"),
  es: () => import("../../../i18n/rede/app/es.json"),
  fr: () => import("../../../i18n/rede/app/fr.json"),
  ru: () => import("../../../i18n/rede/app/ru.json"),
  zh: () => import("../../../i18n/rede/app/zh.json"),
};

/** Os textos do idioma pedido; idioma desconhecido cai no português. */
export async function carregarTextosDoApp(lang: string): Promise<TextosDoApp> {
  return (await carregarPronto(CARREGAR, lang)) as TextosDoApp;
}

/** Troca {chave} pelos valores. */
export function preencherApp(texto: string, valores: Record<string, string>): string {
  return texto.replace(/\{(\w+)\}/g, (inteiro, chave: string) => valores[chave] ?? inteiro);
}
