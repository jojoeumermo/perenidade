// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos da ponte com a Escola: i18n/rede/conquistas/{pt,en,es,fr,ru,zh}.json (pt é o texto final; os outros têm "_rascunho":
// true até a revisão). Um idioma por vez, por import dinâmico; o hook fica em usarTextos.ts.
import type pt from "../../../../i18n/rede/conquistas/pt.json";

export type TextosDasConquistas = typeof pt;

const IDIOMAS = ["pt", "en", "es", "fr", "ru", "zh"] as const;

export async function carregarTextosDasConquistas(lang: string): Promise<TextosDasConquistas> {
  const l = (IDIOMAS as readonly string[]).includes(lang) ? lang : "pt";
  try {
    return ((await import(`../../../../i18n/rede/conquistas/${l}.json`)) as { default: TextosDasConquistas }).default;
  } catch {
    return ((await import("../../../../i18n/rede/conquistas/pt.json")) as { default: TextosDasConquistas }).default;
  }
}

/** Troca {chave} pelo valor (texto ou número). */
export function por(texto: string, valores: Record<string, string | number>): string {
  return texto.replace(/\{(\w+)\}/g, (inteiro, chave: string) => (chave in valores ? String(valores[chave]) : inteiro));
}

/** O texto de um erro do banco pela tabela da tela: o código inteiro, depois o prefixo antes de ":", depois o genérico. */
export function textoDoErro(tabela: Record<string, string>, erro: unknown): string {
  const codigo = erro && typeof erro === "object" && "code" in erro && typeof (erro as { code: unknown }).code === "string"
    ? (erro as { code: string }).code
    : erro instanceof Error ? erro.message : String(erro ?? "");
  return tabela[codigo] ?? tabela[codigo.split(":")[0]] ?? tabela.generico;
}

/** "2026-11" no idioma da página ("nov. de 2026"). */
export function mesEscrito(lang: string, data: Date | null, cru: string): string {
  if (!data) return cru;
  try {
    return new Intl.DateTimeFormat(lang === "pt" ? "pt-BR" : lang, { month: "short", year: "numeric", timeZone: "UTC" }).format(data);
  } catch {
    return cru;
  }
}

/** A primeira letra em maiúscula (o nome de uma trilha vem do endereço). */
export const comMaiuscula = (s: string): string => (s ? s.charAt(0).toLocaleUpperCase() + s.slice(1) : s);
