// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O navegador e o sistema de um "user agent", em códigos curtos: a mesma regra de interno.alumia_navegador
// (supabase/migracoes/20261114-alumia-o8-conta.sql). O teste (scripts/testar-alumia-o8-conta.mjs) confere que as duas dão o mesmo.
// Nada além do navegador e do sistema sai do texto: nem versão, nem modelo do aparelho.
// Sem "@/" de propósito: roda no Node nos testes.

export type CodigoDoNavegador = "firefox" | "edge" | "opera" | "chrome" | "safari" | "outro";
export type CodigoDoSistema = "android" | "ios" | "windows" | "macos" | "linux" | "outro";

export interface Navegador {
  navegador: CodigoDoNavegador;
  sistema: CodigoDoSistema;
}

/** "Mozilla/5.0 (X11; Linux x86_64) … Firefox/128.0" → { navegador: "firefox", sistema: "linux" }. */
export function navegadorDe(agente: string | null | undefined): Navegador {
  const a = agente ?? "";
  const navegador: CodigoDoNavegador = /Firefox\//.test(a) ? "firefox" : /Edg\//.test(a) ? "edge" : /OPR\//.test(a) ? "opera" : /Chrome\//.test(a) ? "chrome" : /Safari\//.test(a) ? "safari" : "outro";
  const sistema: CodigoDoSistema = /Android/.test(a) ? "android" : /iPhone|iPad/.test(a) ? "ios" : /Windows/.test(a) ? "windows" : /Mac OS X/.test(a) ? "macos" : /Linux/.test(a) ? "linux" : "outro";
  return { navegador, sistema };
}

/** Os nomes que a tela mostra (iguais em todo idioma, menos "outro", que vem dos textos). */
export const NOMES_DOS_NAVEGADORES: Record<Exclude<CodigoDoNavegador, "outro">, string> = {
  firefox: "Firefox",
  edge: "Edge",
  opera: "Opera",
  chrome: "Chrome",
  safari: "Safari",
};
export const NOMES_DOS_SISTEMAS: Record<Exclude<CodigoDoSistema, "outro" | "ios">, string> = {
  android: "Android",
  windows: "Windows",
  macos: "macOS",
  linux: "Linux",
};
