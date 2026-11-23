// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Os textos do grupo presença e print (prompt 4, itens 1, 6 e 9): i18n/rede/p4-presenca-print/{pt,en,es,fr,ru,zh}.json (pt é o
// texto final; os outros têm "_rascunho": true até a revisão). Um idioma por vez, por import dinâmico.
import { useEffect, useState } from "react";
import type pt from "../../../i18n/rede/p4-presenca-print/pt.json";
import { prontoOu } from "../../../lib/rede/textos-prontos";

export type TextosDePresencaEPrint = typeof pt;

const IDIOMAS = ["pt", "en", "es", "fr", "ru", "zh"] as const;
const portugues = async () => ((await import("../../../i18n/rede/p4-presenca-print/pt.json")) as { default: TextosDePresencaEPrint }).default;

export async function carregarTextosDePresencaEPrint(lang: string): Promise<TextosDePresencaEPrint> {
  const l = (IDIOMAS as readonly string[]).includes(lang) ? lang : "pt";
  try {
    return prontoOu(((await import(`../../../i18n/rede/p4-presenca-print/${l}.json`)) as { default: TextosDePresencaEPrint }).default, portugues);
  } catch {
    return portugues();
  }
}

/** Os textos no idioma da página; `null` enquanto chegam. */
export function useTextosDePresencaEPrint(lang: string, ligado = true): TextosDePresencaEPrint | null {
  const [pronto, setPronto] = useState<{ lang: string; t: TextosDePresencaEPrint } | null>(null);
  useEffect(() => {
    if (!ligado) return;
    let vivo = true;
    void carregarTextosDePresencaEPrint(lang).then((t) => vivo && setPronto({ lang, t }));
    return () => {
      vivo = false;
    };
  }, [lang, ligado]);
  return ligado && pronto?.lang === lang ? pronto.t : null;
}
