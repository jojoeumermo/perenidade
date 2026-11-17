// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { carregarTextosDasPontes, type TextosDasPontes } from "./textos";

/** Os textos no idioma da página; `null` enquanto chegam. */
export function useTextosDasPontes(lang: string): TextosDasPontes | null {
  const [pronto, setPronto] = useState<{ lang: string; t: TextosDasPontes } | null>(null);
  useEffect(() => {
    let vivo = true;
    carregarTextosDasPontes(lang).then((t) => vivo && setPronto({ lang, t }));
    return () => {
      vivo = false;
    };
  }, [lang]);
  return pronto?.lang === lang ? pronto.t : null;
}
