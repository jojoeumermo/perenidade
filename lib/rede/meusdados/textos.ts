// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos de "Meus dados" (exportar e apagar a conta, a seção nos ajustes e a página do arquivo exportado):
// i18n/rede/meusdados/{pt,en,es,fr,ru,zh}.json. O português é o final; os outros cinco são rascunho marcado. Carrega só o idioma
// pedido, sob demanda. Sem "@/" de propósito (o servidor do arquivo e os testes também leem daqui).
import type pt from "../../../i18n/rede/meusdados/pt.json";
import { carregarPronto } from "../textos-prontos";

export type TextosDeMeusDados = typeof pt;

const CARREGAR: Record<string, () => Promise<{ default: unknown }>> = {
  pt: () => import("../../../i18n/rede/meusdados/pt.json"),
  en: () => import("../../../i18n/rede/meusdados/en.json"),
  es: () => import("../../../i18n/rede/meusdados/es.json"),
  fr: () => import("../../../i18n/rede/meusdados/fr.json"),
  ru: () => import("../../../i18n/rede/meusdados/ru.json"),
  zh: () => import("../../../i18n/rede/meusdados/zh.json"),
};

/** Os idiomas que a página do arquivo conhece (o resto cai no português). */
export const IDIOMAS_DE_MEUS_DADOS = Object.keys(CARREGAR);

/** Os textos do idioma pedido; idioma desconhecido cai no português. */
export async function carregarTextosDeMeusDados(lang: string): Promise<TextosDeMeusDados> {
  return (await carregarPronto(CARREGAR, lang)) as TextosDeMeusDados;
}

/** Troca {nome} pelo valor (o mesmo jeito dos outros textos da Alumia). */
export function encher(texto: string, valores: Record<string, string | number>): string {
  return texto.replace(/\{(\w+)\}/g, (inteiro, nome: string) => (nome in valores ? String(valores[nome]) : inteiro));
}
