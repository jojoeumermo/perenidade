// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos do áudio e do vídeo curto no chat (Prompt 4, itens 137 e 138): i18n/rede/chat-anexo/{pt,en,es,fr,ru,zh}.json (pt é o
// final; os outros cinco são rascunho marcado e mostram o português até a revisão). Carrega só o idioma pedido, sob demanda.
// Sem "@/" de propósito (roda no Node nos testes).
import type pt from "../../i18n/rede/chat-anexo/pt.json";
import { carregarPronto } from "./textos-prontos";

export type TextosDoAnexo = typeof pt;

const CARREGAR: Record<string, () => Promise<{ default: unknown }>> = {
  pt: () => import("../../i18n/rede/chat-anexo/pt.json"),
  en: () => import("../../i18n/rede/chat-anexo/en.json"),
  es: () => import("../../i18n/rede/chat-anexo/es.json"),
  fr: () => import("../../i18n/rede/chat-anexo/fr.json"),
  ru: () => import("../../i18n/rede/chat-anexo/ru.json"),
  zh: () => import("../../i18n/rede/chat-anexo/zh.json"),
};

/** Os textos do idioma pedido; idioma desconhecido cai no português. */
export async function carregarTextosDoAnexo(lang: string): Promise<TextosDoAnexo> {
  return (await carregarPronto(CARREGAR, lang)) as TextosDoAnexo;
}
