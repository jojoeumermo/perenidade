// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos da porta de entrada e dos convites: i18n/rede/convites/{pt,en,es,fr,ru,zh}.json (pt é o texto final; os outros têm
// "_rascunho": true até a revisão). UM idioma por vez, por import dinâmico. Serve ao servidor (as páginas) e ao navegador.
import type pt from "../../../i18n/rede/convites/pt.json";
import { prontoOu } from "../textos-prontos";

export type TextosDosConvites = typeof pt;

const IDIOMAS = ["pt", "en", "es", "fr", "ru", "zh"] as const;

export async function carregarTextosDosConvites(lang: string): Promise<TextosDosConvites> {
  const l = (IDIOMAS as readonly string[]).includes(lang) ? lang : "pt";
  try {
    return prontoOu(((await import(`../../../i18n/rede/convites/${l}.json`)) as { default: TextosDosConvites }).default, async () => ((await import("../../../i18n/rede/convites/pt.json")) as { default: TextosDosConvites }).default);
  } catch {
    return ((await import("../../../i18n/rede/convites/pt.json")) as { default: TextosDosConvites }).default;
  }
}

/** Troca {chave} pelo valor. */
export function preencher(texto: string, valores: Record<string, string | number>): string {
  return texto.replace(/\{(\w+)\}/g, (_, k: string) => (k in valores ? String(valores[k]) : `{${k}}`));
}

const LOCALES: Record<string, string> = { pt: "pt-BR", en: "en", es: "es", fr: "fr", ru: "ru", zh: "zh-CN" };

/** Uma data curta no idioma da página (dia e mês, e o ano se não for o corrente). */
export function dataCurta(iso: string | null | undefined, lang: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const mesmoAno = d.getFullYear() === new Date().getFullYear();
  return new Intl.DateTimeFormat(LOCALES[lang] ?? "pt-BR", mesmoAno ? { day: "numeric", month: "long" } : { day: "numeric", month: "long", year: "numeric" }).format(d);
}
