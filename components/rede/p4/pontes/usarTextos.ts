// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { carregarTextosDasPontes, type TextosDasPontes } from "./textos";

/** Os textos no idioma da página; `null` enquanto chegam (ou com `ativo` falso: aí nada é carregado). */
export function useTextosDasPontes(lang: string, ativo = true): TextosDasPontes | null {
  const [pronto, setPronto] = useState<{ lang: string; t: TextosDasPontes } | null>(null);
  useEffect(() => {
    if (!ativo) return;
    let vivo = true;
    carregarTextosDasPontes(lang).then((t) => vivo && setPronto({ lang, t }));
    return () => {
      vivo = false;
    };
  }, [lang, ativo]);
  return ativo && pronto?.lang === lang ? pronto.t : null;
}
