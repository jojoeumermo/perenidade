// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos do pacote avisos: i18n/rede/avisos/{pt,en,es,fr,ru,zh}.json (pt é o final; os outros cinco são rascunho marcado).
// Carrega só o idioma pedido, sob demanda (cada arquivo vira um pedaço à parte no pacote): a tela de avisos não traz os seis.
// Sem "@/" de propósito (roda no Node nos testes).
import type pt from "../../i18n/rede/avisos/pt.json";

export type TextosDeAvisos = typeof pt;

const CARREGAR: Record<string, () => Promise<{ default: unknown }>> = {
  pt: () => import("../../i18n/rede/avisos/pt.json"),
  en: () => import("../../i18n/rede/avisos/en.json"),
  es: () => import("../../i18n/rede/avisos/es.json"),
  fr: () => import("../../i18n/rede/avisos/fr.json"),
  ru: () => import("../../i18n/rede/avisos/ru.json"),
  zh: () => import("../../i18n/rede/avisos/zh.json"),
};

/** Os textos do idioma pedido; idioma desconhecido cai no português. */
export async function carregarTextosDeAvisos(lang: string): Promise<TextosDeAvisos> {
  const carregar = CARREGAR[lang] ?? CARREGAR.pt;
  return (await carregar()).default as TextosDeAvisos;
}
