// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O navegador e o sistema de um "user agent", em códigos curtos: a mesma regra de interno.alumia_navegador
// (supabase/migracoes/20261126-p5-entrada.sql, que amplia a de 20261114-alumia-o8-conta.sql). Os testes
// (scripts/testar-alumia-o8-conta.mjs e scripts/testar-p5-entrada.mjs) conferem que as duas dão o mesmo.
// Nada além do navegador e do sistema sai do texto: nem versão, nem modelo do aparelho.
// No servidor, as "Client Hints" (Sec-CH-UA, Sec-CH-UA-Platform) completam o que o user agent esconde (o Brave, que se diz Chrome).
// Sem "@/" de propósito: roda no Node nos testes.

export type CodigoDoNavegador = "firefox" | "edge" | "opera" | "vivaldi" | "brave" | "samsung" | "chrome" | "safari" | "outro";
export type CodigoDoSistema = "android" | "ios" | "chromeos" | "windows" | "macos" | "linux" | "outro";

export interface Navegador {
  navegador: CodigoDoNavegador;
  sistema: CodigoDoSistema;
}

/** "Mozilla/5.0 (X11; Linux x86_64) … Firefox/128.0" → { navegador: "firefox", sistema: "linux" }. */
export function navegadorDe(agente: string | null | undefined): Navegador {
  const a = agente ?? "";
  const navegador: CodigoDoNavegador = /Firefox\/|FxiOS\//.test(a)
    ? "firefox"
    : /Edg\/|EdgA\/|EdgiOS\//.test(a)
      ? "edge"
      : /OPR\/|OPiOS\/|OPT\//.test(a)
        ? "opera"
        : /Vivaldi\//.test(a)
          ? "vivaldi"
          : /Brave\//.test(a)
            ? "brave"
            : /SamsungBrowser\/|Samsung\//.test(a)
              ? "samsung"
              : /Chrome\/|CriOS\//.test(a)
                ? "chrome"
                : /Safari\//.test(a)
                  ? "safari"
                  : "outro";
  const sistema: CodigoDoSistema = /Android/.test(a)
    ? "android"
    : /iPhone|iPad|iPod/.test(a)
      ? "ios"
      : /CrOS/.test(a)
        ? "chromeos"
        : /Windows/.test(a)
          ? "windows"
          : /Mac OS X|Macintosh/.test(a)
            ? "macos"
            : /Linux/.test(a)
              ? "linux"
              : "outro";
  return { navegador, sistema };
}

/** O que o cabeçalho de um pedido traz para reconhecer o navegador. */
export interface CabecalhosDoNavegador {
  get(nome: string): string | null;
}

/**
 * O navegador de um pedido no servidor: o user agent e, quando o navegador manda, as Client Hints (Sec-CH-UA traz a marca de
 * verdade do Brave, do Edge e do Opera; Sec-CH-UA-Platform, o sistema quando o user agent vem reduzido). Só os códigos saem daqui.
 */
export function navegadorDoPedido(cabecalhos: CabecalhosDoNavegador): Navegador {
  const base = navegadorDe(cabecalhos.get("user-agent"));
  const marcas = cabecalhos.get("sec-ch-ua") ?? "";
  const plataforma = (cabecalhos.get("sec-ch-ua-platform") ?? "").replace(/"/g, "").trim().toLowerCase();
  let navegador = base.navegador;
  if (navegador === "chrome" || navegador === "outro") {
    if (/"Brave"/.test(marcas)) navegador = "brave";
    else if (/"Microsoft Edge"/.test(marcas)) navegador = "edge";
    else if (/"Opera"/.test(marcas)) navegador = "opera";
    else if (/"Vivaldi"/.test(marcas)) navegador = "vivaldi";
    else if (navegador === "outro" && /"Google Chrome"|"Chromium"/.test(marcas)) navegador = "chrome";
  }
  const PLATAFORMAS: Record<string, CodigoDoSistema> = { windows: "windows", macos: "macos", linux: "linux", android: "android", ios: "ios", "chrome os": "chromeos", chromeos: "chromeos" };
  const sistema = base.sistema === "outro" ? (PLATAFORMAS[plataforma] ?? "outro") : base.sistema;
  return { navegador, sistema };
}

/** Os nomes que a tela mostra (iguais em todo idioma, menos "outro", que vem dos textos). */
export const NOMES_DOS_NAVEGADORES: Record<Exclude<CodigoDoNavegador, "outro">, string> = {
  firefox: "Firefox",
  edge: "Edge",
  opera: "Opera",
  vivaldi: "Vivaldi",
  brave: "Brave",
  samsung: "Samsung Internet",
  chrome: "Chrome",
  safari: "Safari",
};
export const NOMES_DOS_SISTEMAS: Record<Exclude<CodigoDoSistema, "outro" | "ios">, string> = {
  android: "Android",
  chromeos: "ChromeOS",
  windows: "Windows",
  macos: "macOS",
  linux: "Linux",
};
