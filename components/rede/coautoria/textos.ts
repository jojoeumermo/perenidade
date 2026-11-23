// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos da frente 12C (assinar junto, "fonte?", marcar em foto e a checagem do Vale o Escrito na nota): i18n/rede/coautoria/
// {pt,en,es,fr,ru,zh}.json. O português é o final; os outros cinco são rascunho. Carrega só o idioma pedido, sob demanda.
import type pt from "../../../i18n/rede/coautoria/pt.json";
import { prontoDe } from "../../../lib/rede/textos-prontos";

export type TextosDaCoautoria = typeof pt;

const CARREGAR: Record<string, () => Promise<{ default: unknown }>> = {
  pt: () => import("../../../i18n/rede/coautoria/pt.json"),
  en: () => import("../../../i18n/rede/coautoria/en.json"),
  es: () => import("../../../i18n/rede/coautoria/es.json"),
  fr: () => import("../../../i18n/rede/coautoria/fr.json"),
  ru: () => import("../../../i18n/rede/coautoria/ru.json"),
  zh: () => import("../../../i18n/rede/coautoria/zh.json"),
};

const prontos = new Map<string, Promise<TextosDaCoautoria>>();

/** Os textos do idioma pedido; idioma desconhecido cai no português. */
export function carregarTextosDaCoautoria(lang: string): Promise<TextosDaCoautoria> {
  const chave = CARREGAR[lang] ? lang : "pt";
  let p = prontos.get(chave);
  if (!p) {
    p = prontoDe(CARREGAR[chave], CARREGAR.pt).then((d) => d as TextosDaCoautoria);
    prontos.set(chave, p);
  }
  return p;
}

/** Troca {nome} pelo valor. */
export function encher(texto: string, valores: Record<string, string | number>): string {
  return texto.replace(/\{(\w+)\}/g, (inteiro, nome: string) => (nome in valores ? String(valores[nome]) : inteiro));
}

/** O texto do erro que o banco devolveu (o código curto), ou o genérico. */
export function textoDoErro(t: TextosDaCoautoria, erro: unknown): string {
  const codigo = typeof erro === "object" && erro !== null && "code" in erro ? String((erro as { code: unknown }).code) : "";
  return (t.erros as Record<string, string>)[codigo] ?? t.erro;
}
