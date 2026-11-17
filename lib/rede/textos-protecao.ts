// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos da proteção contra ataque (onda 9, frente 9A): i18n/rede/protecao/{pt,en,es,fr,ru,zh}.json. O português é o final; os
// outros cinco são rascunho. Carrega só o idioma pedido, sob demanda, e guarda o que já carregou. Sem "@/" de propósito (os
// testes também leem daqui).
import type pt from "../../i18n/rede/protecao/pt.json";

export type TextosDaProtecao = typeof pt;

const CARREGAR: Record<string, () => Promise<{ default: unknown }>> = {
  pt: () => import("../../i18n/rede/protecao/pt.json"),
  en: () => import("../../i18n/rede/protecao/en.json"),
  es: () => import("../../i18n/rede/protecao/es.json"),
  fr: () => import("../../i18n/rede/protecao/fr.json"),
  ru: () => import("../../i18n/rede/protecao/ru.json"),
  zh: () => import("../../i18n/rede/protecao/zh.json"),
};

const prontos = new Map<string, Promise<TextosDaProtecao>>();

/** Os textos do idioma pedido; idioma desconhecido cai no português. */
export function carregarTextosDaProtecao(lang: string): Promise<TextosDaProtecao> {
  const chave = CARREGAR[lang] ? lang : "pt";
  let p = prontos.get(chave);
  if (!p) {
    p = CARREGAR[chave]().then((m) => m.default as TextosDaProtecao);
    prontos.set(chave, p);
  }
  return p;
}

/** Troca {nome} pelo valor (o mesmo jeito dos outros textos da Alumia). */
export function encher(texto: string, valores: Record<string, string | number>): string {
  return texto.replace(/\{(\w+)\}/g, (inteiro, nome: string) => (nome in valores ? String(valores[nome]) : inteiro));
}

/** A data e a hora no idioma da tela ("16 de nov., 14:30"). */
export function quandoLegivel(iso: string, lang: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const local = { pt: "pt-BR", en: "en-GB", es: "es", fr: "fr-FR", ru: "ru-RU", zh: "zh-CN" }[lang] ?? "pt-BR";
  return d.toLocaleString(local, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
