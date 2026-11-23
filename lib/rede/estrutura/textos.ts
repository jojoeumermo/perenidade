// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos da estrutura das comunidades: i18n/rede/estrutura/{pt,en,es,fr,ru,zh}.json. O português é o texto final; os outros
// cinco são rascunho marcado ("_rascunho"). Cada idioma é um pedaço separado (import dinâmico). Sem "@/" de propósito.
import type pt from "../../../i18n/rede/estrutura/pt.json";
import { carregarPronto } from "../textos-prontos";

export type TextosDaEstrutura = typeof pt;

const CARREGAR: Record<string, () => Promise<{ default: unknown }>> = {
  pt: () => import("../../../i18n/rede/estrutura/pt.json"),
  en: () => import("../../../i18n/rede/estrutura/en.json"),
  es: () => import("../../../i18n/rede/estrutura/es.json"),
  fr: () => import("../../../i18n/rede/estrutura/fr.json"),
  ru: () => import("../../../i18n/rede/estrutura/ru.json"),
  zh: () => import("../../../i18n/rede/estrutura/zh.json"),
};

/** Os textos do idioma pedido; idioma desconhecido cai no português. */
export async function carregarTextosEstrutura(lang: string): Promise<TextosDaEstrutura> {
  return (await carregarPronto(CARREGAR, lang)) as TextosDaEstrutura;
}

/** O código de erro vira o texto do pacote; o que ele não conhece fica para o texto da Rede (nulo). */
export function textoDeErroEstrutura(te: Pick<TextosDaEstrutura, "erros">, codigo: string): string | null {
  const erros = te.erros as Record<string, string>;
  return erros[codigo.split(":")[0]] ?? null;
}
