// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Os textos da ação coletiva (i18n/rede/coletiva/): o português é o final; os outros cinco idiomas são rascunho até a revisão e,
// enquanto forem, a tela mostra o português (lib/rede/textos-prontos.ts).
import { BackendError } from "@/lib/backend";
import { carregarPronto } from "@/lib/rede/textos-prontos";
import { criarUsoDeTextos } from "../mapa/comum";
import type pt from "../../../i18n/rede/coletiva/pt.json";

export type TextosDaColetiva = typeof pt;

const CARREGAR: Record<string, () => Promise<{ default: unknown }>> = {
  pt: () => import("../../../i18n/rede/coletiva/pt.json"),
  en: () => import("../../../i18n/rede/coletiva/en.json"),
  es: () => import("../../../i18n/rede/coletiva/es.json"),
  fr: () => import("../../../i18n/rede/coletiva/fr.json"),
  ru: () => import("../../../i18n/rede/coletiva/ru.json"),
  zh: () => import("../../../i18n/rede/coletiva/zh.json"),
};

export const useTextosDaColetiva = criarUsoDeTextos(async (lang: string) => (await carregarPronto(CARREGAR, lang)) as TextosDaColetiva);

/** A frase de um erro do banco: o código inteiro, depois o prefixo antes de ":", depois o genérico. */
export function fraseDoErro(t: TextosDaColetiva, e: unknown): string {
  const codigo = e instanceof BackendError ? e.code : e instanceof Error ? e.message : "";
  const erros = t.erros as Record<string, string>;
  return erros[codigo] ?? erros[codigo.split(":")[0]] ?? t.erros.outro;
}

/** Uma data (AAAA-MM-DD) curta no idioma da tela, sem mexer no fuso; um instante (ISO com hora), no horário de Brasília. */
export function dataCurta(lang: string, dia: string | null | undefined): string {
  if (!dia || !/^\d{4}-\d{2}-\d{2}/.test(dia)) return "";
  if (dia.length > 10) {
    return new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(dia));
  }
  const [a, m, d] = dia.slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(a, m - 1, d)));
}

/** Troca {chave} pelo valor. */
export const com = (frase: string, valores: Record<string, string | number>) => frase.replace(/\{(\w+)\}/g, (x, k: string) => (k in valores ? String(valores[k]) : x));

/** Escapa um texto para entrar num documento HTML ou SVG. */
export const escapar = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Imprime só um pedaço (o panfleto, o documento), num quadro em branco desta mesma página: nada sai do aparelho. `corpo` já vem
 * escapado ou é um SVG desenhado aqui.
 */
export function imprimirSozinho(titulo: string, corpo: string, estilo = "") {
  const quadro = document.createElement("iframe");
  quadro.setAttribute("aria-hidden", "true");
  quadro.style.cssText = "position:fixed;width:0;height:0;border:0;left:-9999px";
  document.body.appendChild(quadro);
  const doc = quadro.contentDocument;
  if (!doc) return quadro.remove();
  doc.open();
  doc.write(`<!doctype html><meta charset="utf-8"><title>${escapar(titulo)}</title><style>html,body{margin:0}${estilo}</style>${corpo}`);
  doc.close();
  quadro.contentWindow?.focus();
  quadro.contentWindow?.print();
  setTimeout(() => quadro.remove(), 60_000);
}
