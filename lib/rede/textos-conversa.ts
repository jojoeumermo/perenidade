// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos do pacote "conversa": i18n/rede/conversa/{pt,en,es,fr,ru,zh}.json. O português é o texto final; os outros cinco são
// rascunho marcado ("_rascunho") até a revisão. Carregados só no navegador e só em UM idioma, quando a tela da conversa abre
// (import dinâmico: o bundler separa cada idioma em um pedaço próprio). Sem "@/" de propósito.
import type ptAlumia from "../../i18n/rede/conversa/alumia/pt.json";
import type pt from "../../i18n/rede/conversa/pt.json";

export type TextosDaConversa = typeof pt;

const CARREGAR: Record<string, () => Promise<{ default: unknown }>> = {
  pt: () => import("../../i18n/rede/conversa/pt.json"),
  en: () => import("../../i18n/rede/conversa/en.json"),
  es: () => import("../../i18n/rede/conversa/es.json"),
  fr: () => import("../../i18n/rede/conversa/fr.json"),
  ru: () => import("../../i18n/rede/conversa/ru.json"),
  zh: () => import("../../i18n/rede/conversa/zh.json"),
};

/** Os textos do idioma pedido; idioma desconhecido cai no português. */
export async function carregarTextosDaConversa(lang: string): Promise<TextosDaConversa> {
  const carregar = CARREGAR[lang] ?? CARREGAR.pt;
  return (await carregar()).default as TextosDaConversa;
}

// ── Onda 5 (PLANO-ALUMIA F3): os textos das telas novas (comunidade, conversa, comunidades ativas, busca da coluna). ──────────
// i18n/rede/conversa/alumia/{pt,en,es,fr,ru,zh}.json, carregados do mesmo jeito: só no navegador e só o idioma da página.
export type TextosDaAlumia3 = typeof ptAlumia;

const CARREGAR_ALUMIA: Record<string, () => Promise<{ default: unknown }>> = {
  pt: () => import("../../i18n/rede/conversa/alumia/pt.json"),
  en: () => import("../../i18n/rede/conversa/alumia/en.json"),
  es: () => import("../../i18n/rede/conversa/alumia/es.json"),
  fr: () => import("../../i18n/rede/conversa/alumia/fr.json"),
  ru: () => import("../../i18n/rede/conversa/alumia/ru.json"),
  zh: () => import("../../i18n/rede/conversa/alumia/zh.json"),
};

/** Os textos das telas novas da F3 no idioma pedido; idioma desconhecido cai no português. */
export async function carregarTextosDaAlumia3(lang: string): Promise<TextosDaAlumia3> {
  const carregar = CARREGAR_ALUMIA[lang] ?? CARREGAR_ALUMIA.pt;
  return (await carregar()).default as TextosDaAlumia3;
}
