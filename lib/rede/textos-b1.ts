// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos da B1 da comunidade (notas de contexto, wiki, conversas que sigo, busca com filtros, temas seguidos, pastas,
// "Pergunte a…", lembrar mais tarde, posts que se repetem, citação com âncora e "leu antes?"): i18n/rede/b1/{pt,en,es,fr,ru,zh}.json.
// O português é o final; os outros cinco são rascunho marcado. Carrega só o idioma pedido, sob demanda. Sem "@/" de propósito.
import type pt from "../../i18n/rede/b1/pt.json";

export type TextosDaB1 = typeof pt;

const CARREGAR: Record<string, () => Promise<{ default: unknown }>> = {
  pt: () => import("../../i18n/rede/b1/pt.json"),
  en: () => import("../../i18n/rede/b1/en.json"),
  es: () => import("../../i18n/rede/b1/es.json"),
  fr: () => import("../../i18n/rede/b1/fr.json"),
  ru: () => import("../../i18n/rede/b1/ru.json"),
  zh: () => import("../../i18n/rede/b1/zh.json"),
};

/** Os textos do idioma pedido; idioma desconhecido cai no português. */
export async function carregarTextosDaB1(lang: string): Promise<TextosDaB1> {
  const carregar = CARREGAR[lang] ?? CARREGAR.pt;
  return (await carregar()).default as TextosDaB1;
}
