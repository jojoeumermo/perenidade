// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos do pacote descoberta: i18n/rede/descoberta/{pt,en,es,fr,ru,zh}.json. O português é o texto final; os outros cinco são
// rascunho marcado ("_rascunho") até a revisão. Carrega UM idioma por vez, sob demanda (import dinâmico): o navegador nunca baixa os seis.
import type pt from "../../i18n/rede/descoberta/pt.json";

export type TextosDaDescoberta = typeof pt;

const CARREGADORES: Record<string, () => Promise<{ default: unknown }>> = {
  pt: () => import("../../i18n/rede/descoberta/pt.json"),
  en: () => import("../../i18n/rede/descoberta/en.json"),
  es: () => import("../../i18n/rede/descoberta/es.json"),
  fr: () => import("../../i18n/rede/descoberta/fr.json"),
  ru: () => import("../../i18n/rede/descoberta/ru.json"),
  zh: () => import("../../i18n/rede/descoberta/zh.json"),
};

/** Os textos do idioma pedido; idioma desconhecido cai no português. */
export async function carregarTextosDescoberta(lang: string): Promise<TextosDaDescoberta> {
  const carregar = CARREGADORES[lang] ?? CARREGADORES.pt;
  return (await carregar()).default as TextosDaDescoberta;
}
