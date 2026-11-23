// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos da conferência de links (onda 11, 11F): i18n/rede/links/{pt,en,es,fr,ru,zh}.json. O português é o final; os outros
// são rascunho. Um idioma por vez. Sem "@/": os testes leem direto.
import type pt from "../../../i18n/rede/links/pt.json";
import { carregarPronto } from "../textos-prontos";

export type TextosDosLinks = typeof pt;

const CARREGAR: Record<string, () => Promise<{ default: unknown }>> = {
  pt: () => import("../../../i18n/rede/links/pt.json"),
  en: () => import("../../../i18n/rede/links/en.json"),
  es: () => import("../../../i18n/rede/links/es.json"),
  fr: () => import("../../../i18n/rede/links/fr.json"),
  ru: () => import("../../../i18n/rede/links/ru.json"),
  zh: () => import("../../../i18n/rede/links/zh.json"),
};

export async function carregarTextosDosLinks(lang: string): Promise<TextosDosLinks> {
  return (await carregarPronto(CARREGAR, lang)) as TextosDosLinks;
}

/** O nome do lugar de um link, para a frase ("exemplo.com"); o próprio link se não der para ler. */
export function lugarDoLink(link: string): string {
  try {
    return new URL(link).hostname || link;
  } catch {
    return link;
  }
}

/** A frase do bloqueio: um link (com o tipo de perigo) ou vários (com os lugares). */
export function fraseDoBloqueio(t: TextosDosLinks, perigosos: { link: string; tipos: string[] }[]): string {
  const tipos = t.tipos as Record<string, string>;
  if (perigosos.length === 1) {
    const p = perigosos[0];
    return t.bloqueio.replace("{host}", lugarDoLink(p.link)).replace("{tipo}", tipos[p.tipos[0]] ?? tipos.outro);
  }
  return t.varios.replace("{hosts}", [...new Set(perigosos.map((p) => lugarDoLink(p.link)))].join(", "));
}
