// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos da conta segura da Alumia (segurança, aparelhos conectados, pânico, códigos de recuperação, fora da busca):
// i18n/rede/seguranca/{pt,en,es,fr,ru,zh}.json. O português é o final; os outros cinco são rascunho. Carrega só o idioma pedido.
// Sem "@/" de propósito.
import type pt from "../../../i18n/rede/seguranca/pt.json";

export type TextosDaSeguranca = typeof pt;

const CARREGAR: Record<string, () => Promise<{ default: unknown }>> = {
  pt: () => import("../../../i18n/rede/seguranca/pt.json"),
  en: () => import("../../../i18n/rede/seguranca/en.json"),
  es: () => import("../../../i18n/rede/seguranca/es.json"),
  fr: () => import("../../../i18n/rede/seguranca/fr.json"),
  ru: () => import("../../../i18n/rede/seguranca/ru.json"),
  zh: () => import("../../../i18n/rede/seguranca/zh.json"),
};

/** Os textos do idioma pedido; idioma desconhecido cai no português. */
export async function carregarTextosDaSeguranca(lang: string): Promise<TextosDaSeguranca> {
  const carregar = CARREGAR[lang] ?? CARREGAR.pt;
  return (await carregar()).default as TextosDaSeguranca;
}
