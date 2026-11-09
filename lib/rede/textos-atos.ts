// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos dos atos (frente F2): i18n/rede/atos/{pt,en,es,fr,ru,zh}.json. Carrega só o idioma pedido, sob demanda, e guarda
// o que já veio (as várias peças da mesma tela pedem juntas). Sem "@/" de propósito (roda no Node nos testes).
import type pt from "../../i18n/rede/atos/pt.json";

export type TextosDosAtos = typeof pt;

const CARREGAR: Record<string, () => Promise<{ default: unknown }>> = {
  pt: () => import("../../i18n/rede/atos/pt.json"),
  en: () => import("../../i18n/rede/atos/en.json"),
  es: () => import("../../i18n/rede/atos/es.json"),
  fr: () => import("../../i18n/rede/atos/fr.json"),
  ru: () => import("../../i18n/rede/atos/ru.json"),
  zh: () => import("../../i18n/rede/atos/zh.json"),
};

const JA: Record<string, Promise<TextosDosAtos>> = {};

/** Os textos do idioma pedido; idioma desconhecido cai no português. */
export function carregarTextosDosAtos(lang: string): Promise<TextosDosAtos> {
  const chave = CARREGAR[lang] ? lang : "pt";
  JA[chave] ??= CARREGAR[chave]().then((m) => m.default as TextosDosAtos);
  return JA[chave];
}

/** Troca {chave} pelos valores ("faltam {d} dias" → "faltam 2 dias"). */
export function preencherAto(texto: string, valores: Record<string, string | number>): string {
  return texto.replace(/\{(\w+)\}/g, (_, k: string) => (k in valores ? String(valores[k]) : `{${k}}`));
}
