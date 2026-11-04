// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos do pacote "conversa": i18n/rede/conversa/{pt,en,es,fr,ru,zh}.json. O português é o texto final; os outros cinco são
// rascunho marcado ("_rascunho") até a revisão. Carregados só no navegador e só em UM idioma, quando a tela da conversa abre
// (import dinâmico: o bundler separa cada idioma em um pedaço próprio). Sem "@/" de propósito.
import type pt from "../../i18n/rede/conversa/pt.json";

export type TextosDaConversa = typeof pt;

const CARREGAR: Record<string, () => Promise<{ default: unknown }>> = {
  pt: () => import("../../i18n/rede/conversa/pt.json"),
  en: () => import("../../i18n/rede/conversa/en.json"),
  es: () => import("../../i18n/rede/conversa/es.json"),
  fr: () => import("../../i18n/rede/conversa/fr.json"),
  ru: () => import("../../i18n/rede/conversa/ru.json"),
  zh: () => import("../../i18n/rede/conversa/zh.json"),
};

/** Os textos do idioma pedido; idioma desconhecido cai no português. */
export async function carregarTextosDaConversa(lang: string): Promise<TextosDaConversa> {
  const carregar = CARREGAR[lang] ?? CARREGAR.pt;
  return (await carregar()).default as TextosDaConversa;
}
