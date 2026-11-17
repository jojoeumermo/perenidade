// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos da frente 13C (sair da Alumia): i18n/rede/alcance/{pt,en,es,fr,ru,zh}.json. O português é o texto final; os outros
// cinco são rascunho marcado ("_rascunho"). No navegador, cada idioma é um pedaço separado (import dinâmico); as rotas do servidor
// (RSS e cartão) leem os seis de uma vez (textosDoServidor). Sem "@/" de propósito.
import type pt from "../../../i18n/rede/alcance/pt.json";

export type TextosDoAlcance = typeof pt;

const CARREGAR: Record<string, () => Promise<{ default: unknown }>> = {
  pt: () => import("../../../i18n/rede/alcance/pt.json"),
  en: () => import("../../../i18n/rede/alcance/en.json"),
  es: () => import("../../../i18n/rede/alcance/es.json"),
  fr: () => import("../../../i18n/rede/alcance/fr.json"),
  ru: () => import("../../../i18n/rede/alcance/ru.json"),
  zh: () => import("../../../i18n/rede/alcance/zh.json"),
};

/** Os textos do idioma pedido; idioma desconhecido cai no português. */
export async function carregarTextosDoAlcance(lang: string): Promise<TextosDoAlcance> {
  const carregar = CARREGAR[lang] ?? CARREGAR.pt;
  return (await carregar()).default as TextosDoAlcance;
}

/** O código de erro vira o texto da frente (ou o genérico). */
export function textoDoErroDoAlcance(t: Pick<TextosDoAlcance, "erros">, codigo: string): string {
  const erros = t.erros as Record<string, string>;
  return erros[codigo] ?? erros[codigo.split(":")[0]] ?? t.erros.generico;
}
