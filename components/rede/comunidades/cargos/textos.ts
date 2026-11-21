// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos de cargos e chegada: i18n/rede/cargos/{pt,en,es,fr,ru,zh}.json (pt é o texto final; os outros têm "_rascunho": true
// até a revisão). Um idioma por vez, por import dinâmico; o hook fica em usarTextos.ts.
import type pt from "../../../../i18n/rede/cargos/pt.json";
import { prontoOu } from "../../../../lib/rede/textos-prontos";

export type TextosDosCargos = typeof pt;

const IDIOMAS = ["pt", "en", "es", "fr", "ru", "zh"] as const;

export async function carregarTextosDosCargos(lang: string): Promise<TextosDosCargos> {
  const l = (IDIOMAS as readonly string[]).includes(lang) ? lang : "pt";
  try {
    return prontoOu(((await import(`../../../../i18n/rede/cargos/${l}.json`)) as { default: TextosDosCargos }).default, async () => ((await import("../../../../i18n/rede/cargos/pt.json")) as { default: TextosDosCargos }).default);
  } catch {
    return ((await import("../../../../i18n/rede/cargos/pt.json")) as { default: TextosDosCargos }).default;
  }
}

/** Troca {chave} pelo valor (texto ou número). */
export function por(texto: string, valores: Record<string, string | number>): string {
  return texto.replace(/\{(\w+)\}/g, (inteiro, chave: string) => (chave in valores ? String(valores[chave]) : inteiro));
}

/** Uma data curta no idioma da página ("16 de nov."). */
export function dataCurta(lang: string, iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat(lang === "pt" ? "pt-BR" : lang, { day: "numeric", month: "short" }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

/** O texto de um erro do banco pela tabela da tela: o código inteiro, depois o prefixo antes de ":", depois o genérico. */
export function textoDoErro(tabela: Record<string, string>, erro: unknown): string {
  const codigo = erro && typeof erro === "object" && "code" in erro && typeof (erro as { code: unknown }).code === "string"
    ? (erro as { code: string }).code
    : erro instanceof Error ? erro.message : String(erro ?? "");
  return tabela[codigo] ?? tabela[codigo.split(":")[0]] ?? tabela.generico;
}
