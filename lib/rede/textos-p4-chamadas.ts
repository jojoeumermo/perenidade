// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos das chamadas da conversa a dois do Prompt 4 (itens 139 e 140, atrás de "alumia-p4-chamadas"):
// i18n/rede/p4-chamadas/{pt,en,es,fr,ru,zh}.json (pt é o final; os outros cinco são rascunho marcado e mostram o português até a
// revisão). Carrega só o idioma pedido. Sem "@/" de propósito (roda no Node nos testes).
import type pt from "../../i18n/rede/p4-chamadas/pt.json";
import { carregarPronto } from "./textos-prontos";

export type TextosDasChamadas = typeof pt;

const CARREGAR: Record<string, () => Promise<{ default: unknown }>> = {
  pt: () => import("../../i18n/rede/p4-chamadas/pt.json"),
  en: () => import("../../i18n/rede/p4-chamadas/en.json"),
  es: () => import("../../i18n/rede/p4-chamadas/es.json"),
  fr: () => import("../../i18n/rede/p4-chamadas/fr.json"),
  ru: () => import("../../i18n/rede/p4-chamadas/ru.json"),
  zh: () => import("../../i18n/rede/p4-chamadas/zh.json"),
};

/** Os textos do idioma pedido; idioma desconhecido cai no português. */
export async function carregarTextosDasChamadas(lang: string): Promise<TextosDasChamadas> {
  return (await carregarPronto(CARREGAR, lang)) as TextosDasChamadas;
}
