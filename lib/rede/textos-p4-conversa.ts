// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos do lote da conversa do Prompt 4 (itens 13 a 21, atrás de "alumia-p4-conversa"): i18n/rede/p4-conversa/{pt,en,es,fr,ru,
// zh}.json (pt é o final; os outros cinco são rascunho marcado e mostram o português até a revisão). Carrega só o idioma pedido.
// Sem "@/" de propósito (roda no Node nos testes).
import type pt from "../../i18n/rede/p4-conversa/pt.json";
import { carregarPronto } from "./textos-prontos";

export type TextosDaConversaP4 = typeof pt;

const CARREGAR: Record<string, () => Promise<{ default: unknown }>> = {
  pt: () => import("../../i18n/rede/p4-conversa/pt.json"),
  en: () => import("../../i18n/rede/p4-conversa/en.json"),
  es: () => import("../../i18n/rede/p4-conversa/es.json"),
  fr: () => import("../../i18n/rede/p4-conversa/fr.json"),
  ru: () => import("../../i18n/rede/p4-conversa/ru.json"),
  zh: () => import("../../i18n/rede/p4-conversa/zh.json"),
};

/** Os textos do idioma pedido; idioma desconhecido cai no português. */
export async function carregarTextosDaConversaP4(lang: string): Promise<TextosDaConversaP4> {
  return (await carregarPronto(CARREGAR, lang)) as TextosDaConversaP4;
}
