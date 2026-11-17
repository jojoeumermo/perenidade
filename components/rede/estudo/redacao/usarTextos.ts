// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { carregarTextosDaRedacao, type TextosDaRedacao } from "./textos";

/** Os textos no idioma da página; `null` enquanto chegam. */
export function useTextosDaRedacao(lang: string): TextosDaRedacao | null {
  const [pronto, setPronto] = useState<{ lang: string; t: TextosDaRedacao } | null>(null);
  useEffect(() => {
    let vivo = true;
    carregarTextosDaRedacao(lang).then((t) => vivo && setPronto({ lang, t }));
    return () => {
      vivo = false;
    };
  }, [lang]);
  return pronto?.lang === lang ? pronto.t : null;
}
