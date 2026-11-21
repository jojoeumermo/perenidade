// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Os textos das seções do perfil, dos links, do voluntariado e dos pacotes (onda 12, 12D): i18n/rede/perfil/secoes/{pt,en,es,fr,ru,zh}.json
// (pt é o texto final; os outros têm "_rascunho": true até a revisão). UM idioma por vez, por import dinâmico.
import { useEffect, useState } from "react";
import type pt from "../../../../i18n/rede/perfil/secoes/pt.json";
import { prontoOu } from "../../../../lib/rede/textos-prontos";

export type TextosDasSecoes = typeof pt;

const IDIOMAS = ["pt", "en", "es", "fr", "ru", "zh"] as const;

export async function carregarTextosDasSecoes(lang: string): Promise<TextosDasSecoes> {
  const l = (IDIOMAS as readonly string[]).includes(lang) ? lang : "pt";
  try {
    return prontoOu(((await import(`../../../../i18n/rede/perfil/secoes/${l}.json`)) as { default: TextosDasSecoes }).default, async () => ((await import("../../../../i18n/rede/perfil/secoes/pt.json")) as { default: TextosDasSecoes }).default);
  } catch {
    return ((await import("../../../../i18n/rede/perfil/secoes/pt.json")) as { default: TextosDasSecoes }).default;
  }
}

/** Os textos no idioma da página; `null` enquanto chegam. */
export function useTextosDasSecoes(lang: string): TextosDasSecoes | null {
  const [pronto, setPronto] = useState<{ lang: string; t: TextosDasSecoes } | null>(null);
  useEffect(() => {
    let vivo = true;
    carregarTextosDasSecoes(lang).then((t) => vivo && setPronto({ lang, t }));
    return () => {
      vivo = false;
    };
  }, [lang]);
  return pronto?.lang === lang ? pronto.t : null;
}
