// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos dos stories (PLANO-ALUMIA F5): i18n/rede/stories/{pt,en,es,fr,ru,zh}.json (pt é o final; os outros cinco são
// rascunho). O navegador baixa SÓ o idioma da pessoa, e só quando a faixa, o visor ou o "criar" aparecem. Sem "@/" de propósito
// (roda no Node nos testes).
import type pt from "../../i18n/rede/stories/pt.json";

export type TextosDosStories = typeof pt;

const CARREGAR: Record<string, () => Promise<{ default: unknown }>> = {
  pt: () => import("../../i18n/rede/stories/pt.json"),
  en: () => import("../../i18n/rede/stories/en.json"),
  es: () => import("../../i18n/rede/stories/es.json"),
  fr: () => import("../../i18n/rede/stories/fr.json"),
  ru: () => import("../../i18n/rede/stories/ru.json"),
  zh: () => import("../../i18n/rede/stories/zh.json"),
};

export const IDIOMAS_DOS_STORIES = Object.keys(CARREGAR);

const guardados = new Map<string, Promise<TextosDosStories>>();

/** Os textos do idioma pedido (uma vez por idioma); idioma desconhecido cai no português. */
export function carregarTextosDosStories(lang: string): Promise<TextosDosStories> {
  const l = lang in CARREGAR ? lang : "pt";
  let p = guardados.get(l);
  if (!p) {
    p = CARREGAR[l]().then((m) => m.default as TextosDosStories);
    guardados.set(l, p);
  }
  return p;
}
