// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Os textos do grupo "memória e luta" (i18n/rede/memoria/): o português é o final; os outros cinco idiomas são rascunho até a
// revisão e, enquanto forem, a tela mostra o português (lib/rede/textos-prontos.ts).
import { BackendError } from "@/lib/backend";
import { carregarPronto } from "@/lib/rede/textos-prontos";
import { criarUsoDeTextos } from "../mapa/comum";
import type pt from "../../../i18n/rede/memoria/pt.json";

export type TextosDaMemoria = typeof pt;

const CARREGAR: Record<string, () => Promise<{ default: unknown }>> = {
  pt: () => import("../../../i18n/rede/memoria/pt.json"),
  en: () => import("../../../i18n/rede/memoria/en.json"),
  es: () => import("../../../i18n/rede/memoria/es.json"),
  fr: () => import("../../../i18n/rede/memoria/fr.json"),
  ru: () => import("../../../i18n/rede/memoria/ru.json"),
  zh: () => import("../../../i18n/rede/memoria/zh.json"),
};

export const useTextosDaMemoria = criarUsoDeTextos(async (lang: string) => (await carregarPronto(CARREGAR, lang)) as TextosDaMemoria);

/** A frase de um erro do banco: o código inteiro, depois o prefixo antes de ":", depois o genérico. */
export function fraseDoErroDaMemoria(t: TextosDaMemoria, e: unknown): string {
  const codigo = e instanceof BackendError ? e.code : e instanceof Error ? e.message : "";
  const erros = t.erros as Record<string, string>;
  return erros[codigo] ?? erros[codigo.split(":")[0]] ?? t.erros.outro;
}

/** Uma data (AAAA-MM-DD) por extenso curto no idioma da tela, sem mexer no fuso (é uma data, não um instante). */
export function dataCurta(lang: string, dia: string | null | undefined): string {
  if (!dia || !/^\d{4}-\d{2}-\d{2}/.test(dia)) return "";
  const [a, m, d] = dia.slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(a, m - 1, d)));
}
