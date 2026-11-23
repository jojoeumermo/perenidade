// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Os textos da identidade pública opcional: i18n/rede/identidade/{pt,en,es,fr,ru,zh}.json (pt é o texto final; os outros têm
// "_rascunho": true até a revisão). UM idioma por vez, por import dinâmico.
import { useEffect, useState } from "react";
import type pt from "../../../i18n/rede/identidade/pt.json";
import { prontoOu } from "../../../lib/rede/textos-prontos";

export type TextosDaIdentidade = typeof pt;

const IDIOMAS = ["pt", "en", "es", "fr", "ru", "zh"] as const;

export async function carregarTextosDaIdentidade(lang: string): Promise<TextosDaIdentidade> {
  const l = (IDIOMAS as readonly string[]).includes(lang) ? lang : "pt";
  try {
    return prontoOu(((await import(`../../../i18n/rede/identidade/${l}.json`)) as { default: TextosDaIdentidade }).default, async () => ((await import("../../../i18n/rede/identidade/pt.json")) as { default: TextosDaIdentidade }).default);
  } catch {
    return ((await import("../../../i18n/rede/identidade/pt.json")) as { default: TextosDaIdentidade }).default;
  }
}

/** Os textos no idioma da página; `null` enquanto chegam. */
export function useTextosDaIdentidade(lang: string): TextosDaIdentidade | null {
  const [pronto, setPronto] = useState<{ lang: string; t: TextosDaIdentidade } | null>(null);
  useEffect(() => {
    let vivo = true;
    carregarTextosDaIdentidade(lang).then((t) => vivo && setPronto({ lang, t }));
    return () => {
      vivo = false;
    };
  }, [lang]);
  return pronto?.lang === lang ? pronto.t : null;
}
