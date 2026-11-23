// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos da frente 12B (voz e vídeo): i18n/rede/midia/{pt,en,es,fr,ru,zh}.json. O português é o texto final; os outros cinco
// são rascunho marcado ("_rascunho"). Cada idioma é um pedaço separado (import dinâmico). Sem "@/" de propósito.
import type pt from "../../../i18n/rede/midia/pt.json";
import { carregarPronto } from "../textos-prontos";

export type TextosDaMidia = typeof pt;

const CARREGAR: Record<string, () => Promise<{ default: unknown }>> = {
  pt: () => import("../../../i18n/rede/midia/pt.json"),
  en: () => import("../../../i18n/rede/midia/en.json"),
  es: () => import("../../../i18n/rede/midia/es.json"),
  fr: () => import("../../../i18n/rede/midia/fr.json"),
  ru: () => import("../../../i18n/rede/midia/ru.json"),
  zh: () => import("../../../i18n/rede/midia/zh.json"),
};

/** Os textos do idioma pedido; idioma desconhecido cai no português. */
export async function carregarTextosDaMidia(lang: string): Promise<TextosDaMidia> {
  return (await carregarPronto(CARREGAR, lang)) as TextosDaMidia;
}

/** O código de erro vira o texto do pacote; o que ele não conhece fica para o texto da Rede (nulo). */
export function textoDeErroDaMidia(tm: Pick<TextosDaMidia, "erros">, codigo: string): string | null {
  const erros = tm.erros as Record<string, string>;
  return erros[codigo] ?? erros[codigo.split(":")[0]] ?? null;
}
