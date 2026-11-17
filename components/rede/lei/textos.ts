// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos da lei e da ajuda da Alumia: i18n/rede/lei/{pt,en,es,fr,ru,zh}.json (pt é o texto final; os outros têm
// "_rascunho": true até a revisão). UM idioma por vez, por import dinâmico. Sem hook aqui (o servidor também lê, para os
// metadados): o hook está em usarTextos.ts.
import type pt from "../../../i18n/rede/lei/pt.json";

export type TextosDaLei = typeof pt;

const IDIOMAS = ["pt", "en", "es", "fr", "ru", "zh"] as const;

export async function carregarTextosDaLei(lang: string): Promise<TextosDaLei> {
  const l = (IDIOMAS as readonly string[]).includes(lang) ? lang : "pt";
  try {
    return ((await import(`../../../i18n/rede/lei/${l}.json`)) as { default: TextosDaLei }).default;
  } catch {
    return ((await import("../../../i18n/rede/lei/pt.json")) as { default: TextosDaLei }).default;
  }
}

/** Troca {chave} pelo valor (texto ou número). */
export function por(texto: string, valores: Record<string, string | number>): string {
  return texto.replace(/\{(\w+)\}/g, (inteiro, chave: string) => (chave in valores ? String(valores[chave]) : inteiro));
}
