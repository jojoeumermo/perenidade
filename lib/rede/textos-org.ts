// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos da F4 (perfis e organizações): i18n/rede/org/{pt,en,es,fr,ru,zh}.json (pt é o texto final; os outros cinco têm
// "_rascunho": true até a revisão). Carrega UM idioma por vez (import dinâmico), no servidor ou no navegador. Sem "@/" de propósito.
import type pt from "../../i18n/rede/org/pt.json";

export type TextosDaOrg = typeof pt;

export const IDIOMAS_DA_ORG = ["pt", "en", "es", "fr", "ru", "zh"] as const;

/** Os textos da F4 no idioma pedido; idioma desconhecido ou falha de rede caem no português. */
export async function carregarTextosDaOrg(lang: string): Promise<TextosDaOrg> {
  const l = (IDIOMAS_DA_ORG as readonly string[]).includes(lang) ? lang : "pt";
  try {
    return ((await import(`../../i18n/rede/org/${l}.json`)) as { default: TextosDaOrg }).default;
  } catch {
    return ((await import("../../i18n/rede/org/pt.json")) as { default: TextosDaOrg }).default;
  }
}
