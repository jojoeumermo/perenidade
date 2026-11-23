// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos do lote "pontes" do Prompt 4 (itens 81 a 88 e 130 a 134): i18n/rede/p4-pontes/{pt,en,es,fr,ru,zh}.json (pt é o texto
// final; os outros têm "_rascunho" até a revisão e, até lá, a tela fica em português). Um idioma por vez, por import dinâmico.
import type pt from "../../../../i18n/rede/p4-pontes/pt.json";
import { prontoOu } from "../../../../lib/rede/textos-prontos";

export type TextosDasPontes = typeof pt;

const IDIOMAS = ["pt", "en", "es", "fr", "ru", "zh"] as const;

export async function carregarTextosDasPontes(lang: string): Promise<TextosDasPontes> {
  const l = (IDIOMAS as readonly string[]).includes(lang) ? lang : "pt";
  const portugues = async () => ((await import("../../../../i18n/rede/p4-pontes/pt.json")) as { default: TextosDasPontes }).default;
  try {
    return prontoOu(((await import(`../../../../i18n/rede/p4-pontes/${l}.json`)) as { default: TextosDasPontes }).default, portugues);
  } catch {
    return portugues();
  }
}

/** Troca {chave} pelo valor. */
export function por(texto: string, valores: Record<string, string | number>): string {
  return texto.replace(/\{(\w+)\}/g, (inteiro, chave: string) => (chave in valores ? String(valores[chave]) : inteiro));
}

/** O texto de um erro: o código inteiro, depois o prefixo antes de ":", depois o genérico. */
export function textoDoErro(erros: Record<string, string>, erro: unknown): string {
  const bruto = erro && typeof erro === "object" && "code" in erro && typeof (erro as { code: unknown }).code === "string" ? (erro as { code: string }).code : erro instanceof Error ? erro.message : String(erro ?? "");
  return erros[bruto] ?? erros[bruto.split(":")[0]] ?? erros.generico;
}
