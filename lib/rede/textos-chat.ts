// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos das telas novas da Alumia: o chat privado, i18n/rede/chat/{pt,en,es,fr,ru,zh}.json (pt é o final; os outros
// cinco são rascunho marcado). Carrega só o idioma pedido, sob demanda. Sem "@/" de propósito (roda no Node nos testes).
import type pt from "../../i18n/rede/chat/pt.json";

export type TextosDoChat = typeof pt;

const CARREGAR: Record<string, () => Promise<{ default: unknown }>> = {
  pt: () => import("../../i18n/rede/chat/pt.json"),
  en: () => import("../../i18n/rede/chat/en.json"),
  es: () => import("../../i18n/rede/chat/es.json"),
  fr: () => import("../../i18n/rede/chat/fr.json"),
  ru: () => import("../../i18n/rede/chat/ru.json"),
  zh: () => import("../../i18n/rede/chat/zh.json"),
};

/** Os textos do idioma pedido; idioma desconhecido cai no português. */
export async function carregarTextosDoChat(lang: string): Promise<TextosDoChat> {
  const carregar = CARREGAR[lang] ?? CARREGAR.pt;
  return (await carregar()).default as TextosDoChat;
}
