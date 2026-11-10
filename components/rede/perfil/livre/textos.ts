// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Os textos do perfil livre: i18n/rede/perfil-livre/{pt,en,es,fr,ru,zh}.json (pt é o texto final; os outros têm "_rascunho": true
// até a revisão). UM idioma por vez, por import dinâmico.
import { useEffect, useState } from "react";
import type pt from "../../../../i18n/rede/perfil-livre/pt.json";

export type TextosDoPerfilLivre = typeof pt;

const IDIOMAS = ["pt", "en", "es", "fr", "ru", "zh"] as const;

export async function carregarTextosDoPerfilLivre(lang: string): Promise<TextosDoPerfilLivre> {
  const l = (IDIOMAS as readonly string[]).includes(lang) ? lang : "pt";
  try {
    return ((await import(`../../../../i18n/rede/perfil-livre/${l}.json`)) as { default: TextosDoPerfilLivre }).default;
  } catch {
    return ((await import("../../../../i18n/rede/perfil-livre/pt.json")) as { default: TextosDoPerfilLivre }).default;
  }
}

/** Os textos no idioma da página; `null` enquanto chegam. */
export function useTextosDoPerfilLivre(lang: string): TextosDoPerfilLivre | null {
  const [pronto, setPronto] = useState<{ lang: string; t: TextosDoPerfilLivre } | null>(null);
  useEffect(() => {
    let vivo = true;
    carregarTextosDoPerfilLivre(lang).then((t) => vivo && setPronto({ lang, t }));
    return () => {
      vivo = false;
    };
  }, [lang]);
  return pronto?.lang === lang ? pronto.t : null;
}
