// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos da linha com regra aberta ("Em roda", minhas linhas, assuntos em alta, "enquanto você esteve fora", a página "Como a
// linha é montada" e a ordem das respostas): i18n/rede/linha/{pt,en,es,fr,ru,zh}.json. O português é o final; os outros cinco
// são rascunho marcado. Carrega só o idioma pedido, sob demanda. Sem "@/" de propósito.
import type pt from "../../i18n/rede/linha/pt.json";

export type TextosDaLinha = typeof pt;

const CARREGAR: Record<string, () => Promise<{ default: unknown }>> = {
  pt: () => import("../../i18n/rede/linha/pt.json"),
  en: () => import("../../i18n/rede/linha/en.json"),
  es: () => import("../../i18n/rede/linha/es.json"),
  fr: () => import("../../i18n/rede/linha/fr.json"),
  ru: () => import("../../i18n/rede/linha/ru.json"),
  zh: () => import("../../i18n/rede/linha/zh.json"),
};

/** Os textos do idioma pedido; idioma desconhecido cai no português. */
export async function carregarTextosDaLinha(lang: string): Promise<TextosDaLinha> {
  const carregar = CARREGAR[lang] ?? CARREGAR.pt;
  return (await carregar()).default as TextosDaLinha;
}
