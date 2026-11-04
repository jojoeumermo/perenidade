// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos do pacote de moderação: i18n/rede/moderacao/{pt,en,es,fr,ru,zh}.json. O português é o texto final; os outros cinco são
// rascunho marcado ("_rascunho"). Cada idioma é um pedaço separado (import dinâmico), então o navegador só baixa o que usa, e só
// quando uma tela de moderação abre. Sem "@/" de propósito.
import type pt from "../../i18n/rede/moderacao/pt.json";

export type TextosDaModeracao = typeof pt;

const CARREGAR: Record<string, () => Promise<{ default: unknown }>> = {
  pt: () => import("../../i18n/rede/moderacao/pt.json"),
  en: () => import("../../i18n/rede/moderacao/en.json"),
  es: () => import("../../i18n/rede/moderacao/es.json"),
  fr: () => import("../../i18n/rede/moderacao/fr.json"),
  ru: () => import("../../i18n/rede/moderacao/ru.json"),
  zh: () => import("../../i18n/rede/moderacao/zh.json"),
};

/** Os textos do idioma pedido; idioma desconhecido cai no português. */
export async function carregarTextosMod(lang: string): Promise<TextosDaModeracao> {
  const carregar = CARREGAR[lang] ?? CARREGAR.pt;
  return (await carregar()).default as TextosDaModeracao;
}

/** O código de erro vira o texto do pacote; o que ele não conhece, o chamador resolve com o texto da Rede (erros.<código>). */
export function textoDeErroMod(sm: Pick<TextosDaModeracao, "erros">, codigo: string): string | null {
  const erros = sm.erros as Record<string, string>;
  return erros[codigo.split(":")[0]] ?? null;
}
