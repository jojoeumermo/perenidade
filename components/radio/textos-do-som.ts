// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import type { TextosDoSom } from "@/i18n/escola/som";

// O tocador mora no layout e não recebe os textos do Som do campus por props. Ele só precisa deles quando há o que
// mostrar (o "Continuar" ou o som para estudar ligado) e, aí, baixa só o arquivo do idioma da página: cada import abaixo
// vira um pedaço separado, e o navegador nunca carrega os seis.
const CARREGAR: Record<string, () => Promise<{ default: TextosDoSom }>> = {
  pt: () => import("@/i18n/escola/som/pt.json"),
  en: () => import("@/i18n/escola/som/en.json"),
  es: () => import("@/i18n/escola/som/es.json"),
  fr: () => import("@/i18n/escola/som/fr.json"),
  ru: () => import("@/i18n/escola/som/ru.json"),
  zh: () => import("@/i18n/escola/som/zh.json"),
};

const guardados = new Map<string, TextosDoSom>();

/** Os textos do Som do campus no idioma pedido (o português se o idioma for outro). O tocador usa "player" e os nomes dos sons. */
export async function carregarTextosDoSom(lang: string): Promise<TextosDoSom> {
  const idioma = lang in CARREGAR ? lang : "pt";
  const pronto = guardados.get(idioma);
  if (pronto) return pronto;
  const { default: textos } = await CARREGAR[idioma]();
  guardados.set(idioma, textos);
  return textos;
}
