// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Os textos do questionário de interesses (onda 11, 11F): i18n/rede/interesses/{pt,en,es,fr,ru,zh}.json. O português é o texto
// final; os outros cinco são rascunho. UM idioma por vez, por import dinâmico.
import { useEffect, useState } from "react";
import type pt from "../../../i18n/rede/interesses/pt.json";

export type TextosDosInteresses = typeof pt;

const CARREGAR: Record<string, () => Promise<{ default: unknown }>> = {
  pt: () => import("../../../i18n/rede/interesses/pt.json"),
  en: () => import("../../../i18n/rede/interesses/en.json"),
  es: () => import("../../../i18n/rede/interesses/es.json"),
  fr: () => import("../../../i18n/rede/interesses/fr.json"),
  ru: () => import("../../../i18n/rede/interesses/ru.json"),
  zh: () => import("../../../i18n/rede/interesses/zh.json"),
};

export async function carregarTextosDosInteresses(lang: string): Promise<TextosDosInteresses> {
  return (await (CARREGAR[lang] ?? CARREGAR.pt)()).default as TextosDosInteresses;
}

/** Os textos no idioma da página; `null` enquanto chegam. */
export function useTextosDosInteresses(lang: string): TextosDosInteresses | null {
  const [pronto, setPronto] = useState<{ lang: string; t: TextosDosInteresses } | null>(null);
  useEffect(() => {
    let vivo = true;
    carregarTextosDosInteresses(lang).then((t) => vivo && setPronto({ lang, t }));
    return () => {
      vivo = false;
    };
  }, [lang]);
  return pronto?.lang === lang ? pronto.t : null;
}
