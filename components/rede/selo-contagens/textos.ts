// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Os textos do selo das pessoas e das contagens por escolha (Prompt 4, itens 3 e 5): i18n/rede/selo-contagens/{pt,en,es,fr,ru,zh}.json
// (pt é o texto final; os outros têm "_rascunho": true até a revisão e, até lá, a tela mostra o português). UM idioma por vez.
import { useEffect, useState } from "react";
import type pt from "../../../i18n/rede/selo-contagens/pt.json";
import { prontoOu } from "../../../lib/rede/textos-prontos";

export type TextosDoSelo = typeof pt;

const IDIOMAS = ["pt", "en", "es", "fr", "ru", "zh"] as const;
const portugues = async () => ((await import("../../../i18n/rede/selo-contagens/pt.json")) as { default: TextosDoSelo }).default;

export async function carregarTextosDoSelo(lang: string): Promise<TextosDoSelo> {
  const l = (IDIOMAS as readonly string[]).includes(lang) ? lang : "pt";
  try {
    return prontoOu(((await import(`../../../i18n/rede/selo-contagens/${l}.json`)) as { default: TextosDoSelo }).default, portugues);
  } catch {
    return portugues();
  }
}

/** Os textos no idioma da página; `null` enquanto chegam. */
export function useTextosDoSelo(lang: string): TextosDoSelo | null {
  const [pronto, setPronto] = useState<{ lang: string; t: TextosDoSelo } | null>(null);
  useEffect(() => {
    let vivo = true;
    carregarTextosDoSelo(lang).then((t) => vivo && setPronto({ lang, t }));
    return () => {
      vivo = false;
    };
  }, [lang]);
  return pronto?.lang === lang ? pronto.t : null;
}
