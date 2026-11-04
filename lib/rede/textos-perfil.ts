// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos do pacote "perfil" da Rede v2: i18n/rede/perfil/{pt,en,es,fr,ru,zh}.json (pt é o texto final; os outros cinco têm
// "_rascunho": true até a revisão). Carrega UM idioma por vez (import dinâmico), no servidor ou no navegador, para a Rede não
// baixar os seis. Sem "@/" de propósito.
import type pt from "../../i18n/rede/perfil/pt.json";

export type TextosDoPerfil = typeof pt;

const IDIOMAS = ["pt", "en", "es", "fr", "ru", "zh"] as const;

/** Os textos do perfil no idioma pedido; idioma desconhecido ou falha de rede caem no português. */
export async function carregarTextosDoPerfil(lang: string): Promise<TextosDoPerfil> {
  const l = (IDIOMAS as readonly string[]).includes(lang) ? lang : "pt";
  try {
    return ((await import(`../../i18n/rede/perfil/${l}.json`)) as { default: TextosDoPerfil }).default;
  } catch {
    return ((await import("../../i18n/rede/perfil/pt.json")) as { default: TextosDoPerfil }).default;
  }
}
