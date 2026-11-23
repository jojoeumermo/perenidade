// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos da roda de redação: i18n/rede/redacao/{pt,en,es,fr,ru,zh}.json (pt é o texto final). Um idioma por vez, por import
// dinâmico; o hook fica em usarTextos.ts.
import type pt from "../../../../i18n/rede/redacao/pt.json";
import { prontoOu } from "../../../../lib/rede/textos-prontos";

export type TextosDaRedacao = typeof pt;

const IDIOMAS = ["pt", "en", "es", "fr", "ru", "zh"] as const;

export async function carregarTextosDaRedacao(lang: string): Promise<TextosDaRedacao> {
  const l = (IDIOMAS as readonly string[]).includes(lang) ? lang : "pt";
  try {
    return prontoOu(((await import(`../../../../i18n/rede/redacao/${l}.json`)) as { default: TextosDaRedacao }).default, async () => ((await import("../../../../i18n/rede/redacao/pt.json")) as { default: TextosDaRedacao }).default);
  } catch {
    return ((await import("../../../../i18n/rede/redacao/pt.json")) as { default: TextosDaRedacao }).default;
  }
}

/** Troca {chave} pelo valor (texto ou número). */
export function por(texto: string, valores: Record<string, string | number>): string {
  return texto.replace(/\{(\w+)\}/g, (inteiro, chave: string) => (chave in valores ? String(valores[chave]) : inteiro));
}

/** Uma data no idioma da página: "15 de janeiro" (com o ano se não for o deste ano). "AAAA-MM-DD" é lida como dia, sem fuso. */
export function dataNoIdioma(lang: string, iso: string | null | undefined, comHora = false): string {
  if (!iso) return "";
  const idioma = lang === "pt" ? "pt-BR" : lang;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00`) : new Date(iso);
  const opcoes: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", ...(d.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}) };
  try {
    return new Intl.DateTimeFormat(idioma, comHora ? { ...opcoes, hour: "2-digit", minute: "2-digit" } : opcoes).format(d);
  } catch {
    return iso.slice(0, 10);
  }
}

/** O texto de um erro, pela tabela de erros da tela (o código inteiro, depois o prefixo antes de ":", depois o genérico). */
export function textoDoErro(tabela: Record<string, string>, erro: unknown): string {
  const codigo =
    erro && typeof erro === "object" && "code" in erro && typeof (erro as { code: unknown }).code === "string"
      ? (erro as { code: string }).code
      : erro instanceof Error ? erro.message : String(erro ?? "");
  return tabela[codigo] ?? tabela[codigo.split(":")[0]] ?? tabela.generico;
}
