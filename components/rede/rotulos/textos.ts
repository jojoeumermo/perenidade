// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos dos rótulos, do relatório de transparência e do bloco do painel: i18n/rede/rotulos/{pt,en,es,fr,ru,zh}.json (pt é o
// texto final; os outros têm "_rascunho": true até a revisão). Um idioma por vez, por import dinâmico; o hook fica em usarTextos.ts.
import type pt from "../../../i18n/rede/rotulos/pt.json";
import { prontoOu } from "../../../lib/rede/textos-prontos";

export type TextosDosRotulos = typeof pt;

const IDIOMAS = ["pt", "en", "es", "fr", "ru", "zh"] as const;

export async function carregarTextosDosRotulos(lang: string): Promise<TextosDosRotulos> {
  const l = (IDIOMAS as readonly string[]).includes(lang) ? lang : "pt";
  try {
    return prontoOu(((await import(`../../../i18n/rede/rotulos/${l}.json`)) as { default: TextosDosRotulos }).default, async () => ((await import("../../../i18n/rede/rotulos/pt.json")) as { default: TextosDosRotulos }).default);
  } catch {
    return ((await import("../../../i18n/rede/rotulos/pt.json")) as { default: TextosDosRotulos }).default;
  }
}

/** Troca {chave} pelo valor (texto ou número). */
export function por(texto: string, valores: Record<string, string | number>): string {
  return texto.replace(/\{(\w+)\}/g, (inteiro, chave: string) => (chave in valores ? String(valores[chave]) : inteiro));
}

/** Uma data no idioma da página: "15 de janeiro de 2027" (longa) ou "15 de jan." (curta). A data "AAAA-MM-DD" é lida como dia, sem fuso. */
export function dataNoIdioma(lang: string, iso: string | null | undefined, curta = false): string {
  if (!iso) return "";
  const idioma = lang === "pt" ? "pt-BR" : lang;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00`) : new Date(iso);
  try {
    return new Intl.DateTimeFormat(idioma, curta ? { day: "numeric", month: "short" } : { day: "numeric", month: "long", year: "numeric" }).format(d);
  } catch {
    return iso.slice(0, 10);
  }
}

/** O código de um erro do banco ("invalido:texto", "ja_marcado"…), para escolher o texto da tela. */
export function codigoDoErro(erro: unknown): string {
  if (erro && typeof erro === "object" && "code" in erro && typeof (erro as { code: unknown }).code === "string") return (erro as { code: string }).code;
  return erro instanceof Error ? erro.message : String(erro ?? "");
}

/** O texto de um erro, pela tabela de erros da tela (o código inteiro, depois o prefixo antes de ":", depois o genérico). */
export function textoDoErro(tabela: Record<string, string>, erro: unknown): string {
  const codigo = codigoDoErro(erro);
  return tabela[codigo] ?? tabela[codigo.split(":")[0]] ?? tabela.generico;
}
