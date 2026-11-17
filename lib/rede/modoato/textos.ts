// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos do modo ato (frente 9C): i18n/rede/modoato/{pt,en,es,fr,ru,zh}.json. Carrega só o idioma pedido, sob demanda; o
// guia "Sem sinal?" lê daqui no servidor, para sair pronto no HTML. Sem "@/" de propósito (os testes leem daqui no Node).
import type pt from "../../../i18n/rede/modoato/pt.json";

export type TextosDoModoAto = typeof pt;

const CARREGAR: Record<string, () => Promise<{ default: unknown }>> = {
  pt: () => import("../../../i18n/rede/modoato/pt.json"),
  en: () => import("../../../i18n/rede/modoato/en.json"),
  es: () => import("../../../i18n/rede/modoato/es.json"),
  fr: () => import("../../../i18n/rede/modoato/fr.json"),
  ru: () => import("../../../i18n/rede/modoato/ru.json"),
  zh: () => import("../../../i18n/rede/modoato/zh.json"),
};

/** Os idiomas que o modo ato conhece (o resto cai no português). */
export const IDIOMAS_DO_MODO_ATO = Object.keys(CARREGAR);

/** Os textos do idioma pedido; idioma desconhecido cai no português. */
export async function carregarTextosDoModoAto(lang: string): Promise<TextosDoModoAto> {
  const carregar = CARREGAR[lang] ?? CARREGAR.pt;
  return (await carregar()).default as TextosDoModoAto;
}

/** Troca {nome} pelo valor (o mesmo jeito dos outros textos da Alumia). */
export function encher(texto: string, valores: Record<string, string | number>): string {
  return texto.replace(/\{(\w+)\}/g, (inteiro, nome: string) => (nome in valores ? String(valores[nome]) : inteiro));
}
