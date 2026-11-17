// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos do fórum da comunidade (onda 10, frente 10A): i18n/rede/forum/{pt,en,es,fr,ru,zh}.json. O português é o texto final;
// os outros cinco são rascunho marcado ("_rascunho"). Cada idioma é um pedaço separado (import dinâmico): o navegador só baixa o
// que usa, e só quando o fórum ou uma conversa abre. Sem "@/" de propósito.
import type pt from "../../i18n/rede/forum/pt.json";

export type TextosDoForum = typeof pt;

const CARREGAR: Record<string, () => Promise<{ default: unknown }>> = {
  pt: () => import("../../i18n/rede/forum/pt.json"),
  en: () => import("../../i18n/rede/forum/en.json"),
  es: () => import("../../i18n/rede/forum/es.json"),
  fr: () => import("../../i18n/rede/forum/fr.json"),
  ru: () => import("../../i18n/rede/forum/ru.json"),
  zh: () => import("../../i18n/rede/forum/zh.json"),
};

/** Os textos do idioma pedido; idioma desconhecido cai no português. */
export async function carregarTextosDoForum(lang: string): Promise<TextosDoForum> {
  const carregar = CARREGAR[lang] ?? CARREGAR.pt;
  return (await carregar()).default as TextosDoForum;
}

/** O código de erro do fórum vira o texto do fórum; o que ele não conhece, o chamador resolve com o texto da Rede. */
export function textoDeErroDoForum(tf: Pick<TextosDoForum, "erros">, codigo: string): string | null {
  const erros = tf.erros as Record<string, string>;
  return erros[codigo] ?? erros[codigo.split(":")[0]] ?? null;
}
