// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos das telas novas da Onda 5 enquanto estão "em construção": i18n/rede/onda5/{pt,en,es,fr,ru,zh}.json (pt é o final; os
// outros cinco são rascunho). Carrega só o idioma pedido, sob demanda. Sem "@/" de propósito (roda no Node nos testes).
import type pt from "../../i18n/rede/onda5/pt.json";

export type TextosDaOnda5 = typeof pt;

const CARREGAR: Record<string, () => Promise<{ default: unknown }>> = {
  pt: () => import("../../i18n/rede/onda5/pt.json"),
  en: () => import("../../i18n/rede/onda5/en.json"),
  es: () => import("../../i18n/rede/onda5/es.json"),
  fr: () => import("../../i18n/rede/onda5/fr.json"),
  ru: () => import("../../i18n/rede/onda5/ru.json"),
  zh: () => import("../../i18n/rede/onda5/zh.json"),
};

/** Os textos do idioma pedido; idioma desconhecido cai no português. */
export async function carregarTextosDaOnda5(lang: string): Promise<TextosDaOnda5> {
  const carregar = CARREGAR[lang] ?? CARREGAR.pt;
  return (await carregar()).default as TextosDaOnda5;
}

/** O título e a descrição de uma tela nova; nome desconhecido dá nulo. */
export function textosDaTela(t: TextosDaOnda5, nome: string): { titulo: string; descricao: string } | null {
  return (t.telas as Record<string, { titulo: string; descricao: string } | undefined>)[nome] ?? null;
}
